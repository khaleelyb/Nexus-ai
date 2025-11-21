import React, { useState } from 'react';
import { VirtualFile } from '../types';
import { Copy, Download, Check } from 'lucide-react';

interface EditorProps {
  file: VirtualFile | null;
  onChange: (content: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ file, onChange }) => {
  const [copied, setCopied] = useState(false);

  if (!file) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0f0f11] text-gray-600">
        <div className="text-center">
          <p className="text-lg font-medium">No File Selected</p>
          <p className="text-sm">Select a file from the explorer to view or edit.</p>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    if (file?.content) {
      try {
        await navigator.clipboard.writeText(file.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleDownload = () => {
    if (file) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0f0f11]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#27272a]">
            <span className="text-sm text-gray-300 font-mono truncate mr-4" title={file.path}>{file.path}</span>
            
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-500 uppercase hidden sm:block">{file.language}</span>
                <div className="h-4 w-px bg-[#27272a] hidden sm:block"></div>
                
                <button 
                    onClick={handleCopy} 
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-md transition-all"
                    title="Copy Content"
                >
                    {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
                </button>
                
                <button 
                    onClick={handleDownload} 
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-md transition-all"
                    title="Download File"
                >
                    <Download size={14} />
                </button>
            </div>
        </div>
      <textarea
        className="flex-1 w-full bg-[#0f0f11] text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none leading-relaxed"
        value={file.content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};