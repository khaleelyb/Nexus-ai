import React, { useRef } from 'react';
import { VirtualFile } from '../types';
import { FileCode, File, Folder, Plus, Upload, Github, Trash2, DownloadCloud } from 'lucide-react';

interface FileTreeProps {
  files: VirtualFile[];
  activeFile: VirtualFile | null;
  onSelectFile: (file: VirtualFile) => void;
  onDeleteFile: (path: string) => void;
  onAddFile: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGithubImport: () => void;
  connectedRepo: string | null;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onDeleteFile,
  onAddFile,
  onUpload,
  onGithubImport,
  connectedRepo
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full bg-[#121214] border-r border-[#27272a] w-64 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase">Explorer</h2>
        <div className="flex gap-1">
             <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:bg-[#27272a] rounded-md text-gray-400 hover:text-white transition-colors"
            title="Upload Files"
          >
            <Upload size={14} />
          </button>
          <button 
            onClick={onAddFile}
            className="p-1.5 hover:bg-[#27272a] rounded-md text-gray-400 hover:text-white transition-colors"
            title="New File"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Input Hidden */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef}
        className="hidden"
        onChange={onUpload}
      />

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {files.length === 0 && (
            <div className="text-xs text-gray-500 text-center mt-10 px-4 leading-relaxed">
                <p className="mb-2">No files loaded.</p>
                <button 
                    onClick={onGithubImport}
                    className="text-blue-400 hover:underline cursor-pointer"
                >
                    Import from GitHub
                </button>
                <br/> or upload local files.
            </div>
        )}
        
        {files.map((file) => (
          <div
            key={file.path}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-all ${
              activeFile?.path === file.path
                ? 'bg-[#2a2a35] text-white shadow-sm'
                : 'text-gray-400 hover:bg-[#1e1e20] hover:text-gray-200'
            }`}
            onClick={() => onSelectFile(file)}
          >
            <FileCode size={14} className={activeFile?.path === file.path ? 'text-blue-400' : 'text-gray-600'} />
            <span className="truncate flex-1 font-mono text-[13px]">{file.path}</span>
             <button
                onClick={(e) => { e.stopPropagation(); onDeleteFile(file.path); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
          </div>
        ))}
      </div>

      {/* GitHub Footer */}
      <div className="p-3 border-t border-[#27272a] bg-[#141416]">
         {connectedRepo ? (
             <div className="flex items-center gap-2 p-2 bg-[#1e1e20] rounded border border-[#27272a] text-gray-300 text-xs group relative">
                <Github size={14} className="text-white" />
                <span className="truncate flex-1 font-medium">{connectedRepo}</span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    Repo Connected
                </div>
             </div>
         ) : (
             <button 
                onClick={onGithubImport}
                className="w-full flex items-center justify-center gap-2 p-2 bg-[#1e1e20] hover:bg-[#27272a] rounded border border-[#27272a] text-gray-400 hover:text-white text-xs transition-all"
             >
                <Github size={14} />
                <span>Connect Repository</span>
             </button>
         )}
      </div>
    </div>
  );
};