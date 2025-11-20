import { VirtualFile } from "../types";

export const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    default: return 'text';
  }
};

export const sortFiles = (files: VirtualFile[]): VirtualFile[] => {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
};
