import React from 'react';
import { Message, MessageRole } from '../types';
import { User, Bot, Terminal, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  return (
    <div className={`flex gap-4 p-6 ${isUser ? 'bg-transparent' : 'bg-[#141416]'}`}>
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded flex items-center justify-center ${isUser ? 'bg-purple-600' : 'bg-blue-600'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-200">{isUser ? 'You' : 'Nexus AI'}</span>
          <span className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        
        {/* Tool Calls Visuals */}
        {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
                {message.toolCalls.map((tool, idx) => (
                    <div key={idx} className="bg-[#1e1e20] border border-[#27272a] rounded p-2 text-xs font-mono flex items-center gap-2 text-blue-300">
                         <Terminal size={12} />
                         <span>Executed: <span className="font-bold">{tool.name}</span> ({JSON.stringify(tool.args)})</span>
                         <Check size={12} className="text-green-400 ml-auto" />
                    </div>
                ))}
            </div>
        )}

        <div className="prose prose-invert prose-sm max-w-none text-gray-300">
           {/* Simple whitespace handling for now if markdown is overkill for specific blocks, 
               but ReactMarkdown handles it best. */}
           <ReactMarkdown
             components={{
                code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                    <div className="relative rounded bg-[#1e1e20] my-4 border border-[#27272a] overflow-hidden">
                         <div className="px-3 py-1 text-xs text-gray-500 border-b border-[#27272a] bg-[#18181b] flex justify-between">
                            <span>{match[1]}</span>
                            <span className="cursor-pointer hover:text-white">Copy</span>
                        </div>
                        <pre className="p-3 overflow-x-auto">
                             <code className={className} {...props}>
                                 {children}
                            </code>
                        </pre>
                    </div>
                    ) : (
                    <code className="bg-[#27272a] px-1.5 py-0.5 rounded text-blue-300 text-xs" {...props}>
                        {children}
                    </code>
                    )
                }
             }}
           >
            {message.text}
           </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
