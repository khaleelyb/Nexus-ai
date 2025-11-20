import React from 'react';
import { VirtualFile } from '../types';

interface EditorProps {
  file: VirtualFile | null;
  onChange: (content: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ file, onChange }) => {
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

  return (
    <div className="h-full w-full flex flex-col bg-[#0f0f11]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#27272a]">
            <span className="text-sm text-gray-300 font-mono">{file.path}</span>
            <span className="text-xs text-gray-500 uppercase">{file.language}</span>
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
