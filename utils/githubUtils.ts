import { VirtualFile } from "../types";
import { detectLanguage } from "./fileUtils";

export const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    let cleanUrl = url.trim();
    
    // Remove .git extension if present
    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.slice(0, -4);
    }
    
    // Ensure protocol exists for URL parsing
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const urlObj = new URL(cleanUrl);
    
    // Check hostname
    if (!urlObj.hostname.includes('github.com')) {
      return null;
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Expected format: /owner/repo
    if (pathParts.length >= 2) {
      return { owner: pathParts[0], repo: pathParts[1] };
    }
  } catch (e) {
    // Fallback for simple "owner/repo" string
    const parts = url.trim().split('/');
    if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
  }
  return null;
};

export const fetchGitHubRepo = async (
  owner: string, 
  repo: string, 
  token?: string,
  progressCallback?: (msg: string) => void
): Promise<VirtualFile[]> => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  // Only add Authorization header if token is provided and not empty
  if (token && token.trim().length > 0) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const log = (msg: string) => progressCallback && progressCallback(msg);

  // 1. Get default branch and repo info
  log(`Connecting to GitHub (${owner}/${repo})...`);
  
  let repoData;
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    
    if (repoRes.status === 404) {
      throw new Error('Repository not found. If it is private, please provide a valid GitHub Token.');
    }
    if (repoRes.status === 403 || repoRes.status === 429) {
      throw new Error('GitHub API rate limit exceeded. Please provide a GitHub Token to increase your limit.');
    }
    if (!repoRes.ok) {
      throw new Error(`Failed to connect: ${repoRes.statusText}`);
    }
    repoData = await repoRes.json();
  } catch (error: any) {
     console.error("GitHub Fetch Error:", error);
     throw new Error(error.message || "Unknown network error");
  }

  const branch = repoData.default_branch;
  if (!branch) throw new Error('Could not determine default branch.');

  // 2. Get Tree (Recursive)
  log(`Fetching file tree from branch: ${branch}...`);
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
  
  if (!treeRes.ok) {
     const errData = await treeRes.json().catch(() => ({}));
     throw new Error(errData.message || 'Failed to fetch file tree. The repository might be empty or too large.');
  }
  
  const treeData = await treeRes.json();

  if (treeData.truncated) {
      log("Warning: Repository is too large. Some files were omitted.");
  }

  // Filter blobs (files) only
  // Exclude images, binaries, lockfiles to save bandwidth and context window
  const IGNORED_EXTENSIONS = /\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm|mp3|wav|pdf|zip|tar|gz|7z|rar|lock|exe|dll|so|dylib|class|o|obj|bin|pyc)$/i;
  // Also ignore .git folder contents just in case
  const IGNORED_PATHS = /^\.git\//;

  const MAX_FILES = 150; // Slightly increased

  const filesToFetch = treeData.tree
    .filter((node: any) => node.type === 'blob')
    .filter((node: any) => !IGNORED_EXTENSIONS.test(node.path))
    .filter((node: any) => !IGNORED_PATHS.test(node.path))
    .slice(0, MAX_FILES);

  log(`Downloading ${filesToFetch.length} text files...`);

  const files: VirtualFile[] = [];

  // Fetch in parallel batches to prevent browser network stall
  const BATCH_SIZE = 10; // Increase batch size slightly
  for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
    const batch = filesToFetch.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (node: any) => {
       try {
         const blobRes = await fetch(node.url, { headers }); // Using blob URL from tree response
         if (blobRes.ok) {
            const blobData = await blobRes.json();
            // GitHub API returns content as base64
            // Need to handle unicode characters correctly with base64
            const base64 = blobData.content.replace(/\s/g, '');
            try {
                const binaryString = atob(base64);
                // Decode UTF-8
                const bytes = new Uint8Array(binaryString.length);
                for (let b = 0; b < binaryString.length; b++) {
                    bytes[b] = binaryString.charCodeAt(b);
                }
                const decoder = new TextDecoder('utf-8');
                const content = decoder.decode(bytes);
                
                files.push({
                    name: node.path.split('/').pop() || 'untitled',
                    path: node.path,
                    content: content,
                    language: detectLanguage(node.path)
                });
            } catch (decodeErr) {
                console.warn(`Failed to decode content for ${node.path}`, decodeErr);
            }
         }
       } catch (err) {
         console.error(`Failed to fetch ${node.path}`, err);
       }
    }));
    log(`Downloaded ${Math.min(filesToFetch.length, i + BATCH_SIZE)}/${filesToFetch.length} files...`);
  }

  if (files.length === 0) {
      throw new Error("No text-editable files found in this repository.");
  }

  return files;
};