import React, { useState } from 'react';
import { Github, X, Loader2, AlertCircle } from 'lucide-react';
import { parseGitHubUrl, fetchGitHubRepo } from '../utils/githubUtils';
import { VirtualFile } from '../types';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: VirtualFile[], repoName: string) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose, onImport }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleImport = async () => {
    setError('');
    const repoInfo = parseGitHubUrl(url);
    
    if (!repoInfo) {
      setError('Invalid GitHub URL. Please use format: https://github.com/owner/repo');
      return;
    }

    setIsLoading(true);
    setStatus('Initializing connection...');

    try {
      const files = await fetchGitHubRepo(repoInfo.owner, repoInfo.repo, token, (msg) => setStatus(msg));
      onImport(files, `${repoInfo.owner}/${repoInfo.repo}`);
      onClose();
      setUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to import repository');
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#18181b] border border-[#27272a] w-full max-w-md rounded-xl shadow-2xl p-6 transform transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Github className="text-white" size={24} />
            <h2 className="text-xl font-bold text-white">Import Repository</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Repository URL</label>
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
             <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-gray-400">GitHub Token (Optional)</label>
                <span className="text-xs text-gray-500">For private repos or higher rate limits</span>
             </div>
            <input
              type="password"
              placeholder="github_pat_..."
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start gap-2 text-red-200 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {status && (
             <div className="text-xs text-blue-400 flex items-center gap-2 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                {status}
             </div>
          )}

          <button
            onClick={handleImport}
            disabled={isLoading || !url.trim()}
            className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isLoading || !url.trim()
                ? 'bg-[#27272a] text-gray-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Importing...
              </>
            ) : (
              'Import Repository'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};