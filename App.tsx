import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageRole, VirtualFile, ViewMode } from './types';
import { GeminiService } from './services/geminiService';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { ChatMessage } from './components/ChatMessage';
import { GitHubModal } from './components/GitHubModal';
import { Send, Sidebar as SidebarIcon, LayoutTemplate, Loader2, Maximize2, MessageSquare, Mic, MicOff, Activity } from 'lucide-react';
import { detectLanguage, sortFiles } from './utils/fileUtils';
import { APP_NAME } from './constants';
import { createBlob, decode, decodeAudioData } from './utils/audioUtils';
import { LiveServerMessage } from '@google/genai';

// Environment variable must be present
const API_KEY = process.env.API_KEY || '';

const App: React.FC = () => {
  // State
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [activeFile, setActiveFile] = useState<VirtualFile | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      text: `Hello! I'm ${APP_NAME}. I can help you write code, manage your virtual file system, and explore ideas. 

I am now connected to GitHub! You can:
- **Import a repository** to start editing.
- Ask me to **create, update, rename, or delete** files.
- Use **Live Mode** (microphone icon) to talk to me in real-time!

How can I assist you today?`,
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.SPLIT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Services & Refs
  const geminiRef = useRef<GeminiService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Live Audio Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const filesRef = useRef<VirtualFile[]>(files); // Ref to access current files in closures

  // Update ref when files change
  useEffect(() => {
      filesRef.current = files;
  }, [files]);

  // Initialize Service
  useEffect(() => {
    if (API_KEY) {
      geminiRef.current = new GeminiService(API_KEY);
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Tool Executor
  const handleToolCall = async (name: string, args: any): Promise<any> => {
    console.log('Tool Exec:', name, args);
    const currentFiles = filesRef.current;
    
    if (name === 'createFile' || name === 'updateFile') {
      const { path, content } = args;
      const cleanPath = path.replace(/^\.\//, '');
      
      const newFile: VirtualFile = {
        name: cleanPath.split('/').pop() || 'untitled',
        path: cleanPath,
        content: content,
        language: detectLanguage(cleanPath),
      };

      setFiles(prev => {
        const filtered = prev.filter(f => f.path !== cleanPath);
        const updated = sortFiles([...filtered, newFile]);
        return updated;
      });
      setActiveFile(newFile);

      return `File ${cleanPath} ${name === 'createFile' ? 'created' : 'updated'} successfully.`;
    }

    if (name === 'readFile') {
      const file = currentFiles.find(f => f.path === args.path);
      if (file) return file.content;
      return "Error: File not found.";
    }

    if (name === 'deleteFile') {
        const { path } = args;
        setFiles(prev => prev.filter(f => f.path !== path));
        if (activeFile?.path === path) setActiveFile(null);
        return `File ${path} deleted successfully.`;
    }

    if (name === 'moveFile') {
        const { oldPath, newPath } = args;
        const file = currentFiles.find(f => f.path === oldPath);
        if (!file) return "Error: Source file not found.";
        
        const movedFile = { ...file, path: newPath, name: newPath.split('/').pop() || 'untitled' };
        
        setFiles(prev => {
            const filtered = prev.filter(f => f.path !== oldPath);
            const updated = sortFiles([...filtered, movedFile]);
            return updated;
        });
        setActiveFile(movedFile);
        return `File moved from ${oldPath} to ${newPath}.`;
    }

    if (name === 'listFiles') {
      if (currentFiles.length === 0) return "No files in the virtual file system.";
      return currentFiles.map(f => f.path).join('\n');
    }

    return "Error: Tool not found.";
  };

  // --- Live API Logic ---
  const startLiveSession = async () => {
      if (!geminiRef.current) return;
      
      try {
          setIsLive(true);
          
          // 1. Audio Contexts
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          audioContextRef.current = audioCtx;
          inputContextRef.current = inputCtx;
          
          // 2. Get Mic Stream
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;

          // 3. Connect Live
          const sessionPromise = geminiRef.current.connectLive({
              onopen: () => {
                  console.log("Live Session Open");
                  setIsLiveConnected(true);
                  
                  // Start Input Streaming
                  const source = inputCtx.createMediaStreamSource(stream);
                  const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                  processorRef.current = processor;
                  
                  processor.onaudioprocess = (e) => {
                      const inputData = e.inputBuffer.getChannelData(0);
                      const pcmBlob = createBlob(inputData);
                      sessionPromise.then((session: any) => {
                          session.sendRealtimeInput({ media: pcmBlob });
                      });
                  };
                  
                  source.connect(processor);
                  processor.connect(inputCtx.destination);
              },
              onmessage: async (msg: LiveServerMessage) => {
                  // Handle Audio Output
                  const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (base64Audio) {
                      const ctx = audioContextRef.current;
                      if (ctx) {
                          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                          const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                          const source = ctx.createBufferSource();
                          source.buffer = buffer;
                          source.connect(ctx.destination);
                          source.addEventListener('ended', () => {
                              audioSourcesRef.current.delete(source);
                          });
                          source.start(nextStartTimeRef.current);
                          nextStartTimeRef.current += buffer.duration;
                          audioSourcesRef.current.add(source);
                      }
                  }

                  // Handle Tool Calls in Live
                  if (msg.toolCall) {
                       for (const fc of msg.toolCall.functionCalls) {
                           const result = await handleToolCall(fc.name, fc.args);
                           sessionPromise.then((session: any) => {
                               session.sendToolResponse({
                                   functionResponses: {
                                       id: fc.id,
                                       name: fc.name,
                                       response: { result: JSON.stringify(result) } // Simple string result
                                   }
                               });
                           });
                       }
                  }
              },
              onclose: () => {
                  console.log("Live Session Closed");
                  stopLiveSession();
              },
              onerror: (err) => {
                  console.error("Live Error", err);
                  stopLiveSession();
              }
          });
          
          liveSessionRef.current = sessionPromise;

      } catch (err) {
          console.error("Failed to start live session", err);
          setIsLive(false);
      }
  };

  const stopLiveSession = () => {
      setIsLive(false);
      setIsLiveConnected(false);
      
      // Stop Input
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
      }
      if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
      }
      if (inputContextRef.current) {
          inputContextRef.current.close();
          inputContextRef.current = null;
      }

      // Stop Output
      audioSourcesRef.current.forEach(s => s.stop());
      audioSourcesRef.current.clear();
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }

      // Close Session
      if (liveSessionRef.current) {
          // There is no direct .close() on the promise, but the session obj has it.
          // We rely on the fact that we stop sending input.
          liveSessionRef.current = null;
      }
      nextStartTimeRef.current = 0;
  };


  // --- Standard Chat Handlers ---
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !geminiRef.current || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: inputValue,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const responseText = await geminiRef.current.sendMessage(userMsg.text, handleToolCall);
      
      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: MessageRole.SYSTEM,
        text: "An error occurred while communicating with the AI.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: VirtualFile[] = [];
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          newFiles.push({
            name: file.name,
            path: file.name,
            content,
            language: detectLanguage(file.name)
          });
          if (newFiles.length === e.target.files?.length) {
            setFiles(prev => sortFiles([...prev, ...newFiles]));
          }
        };
        reader.readAsText(file);
      });
    }
  };

  const handleGitHubImport = (importedFiles: VirtualFile[], repoName: string) => {
      setFiles(prev => sortFiles([...prev, ...importedFiles]));
      setConnectedRepo(repoName);
      const systemMsg: Message = {
          id: Date.now().toString(),
          role: MessageRole.SYSTEM,
          text: `Successfully imported ${importedFiles.length} files from **${repoName}**.`,
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, systemMsg]);
  };

  return (
    <div className="flex h-screen bg-[#0f0f11] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      
      <GitHubModal 
        isOpen={isGithubModalOpen} 
        onClose={() => setIsGithubModalOpen(false)}
        onImport={handleGitHubImport}
      />

      {/* Sidebar */}
      {isSidebarOpen && (
        <FileTree 
          files={files} 
          activeFile={activeFile} 
          onSelectFile={setActiveFile}
          onDeleteFile={(path) => {
            setFiles(prev => prev.filter(f => f.path !== path));
            if (activeFile?.path === path) setActiveFile(null);
          }}
          onAddFile={() => {
             const name = prompt("Enter filename:");
             if(name) handleToolCall('createFile', { path: name, content: '' });
          }}
          onUpload={handleFileUpload}
          onGithubImport={() => setIsGithubModalOpen(true)}
          connectedRepo={connectedRepo}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Bar */}
        <header className="h-12 border-b border-[#27272a] flex items-center justify-between px-4 bg-[#0f0f11] select-none">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white transition-colors">
                    <SidebarIcon size={18} />
                </button>
                <span className="font-semibold text-sm tracking-wide">{APP_NAME}</span>
                {isLive && (
                     <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20 animate-pulse">
                         <Activity size={12} />
                         {isLiveConnected ? 'LIVE AUDIO' : 'CONNECTING...'}
                     </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                {/* Live Mode Toggle */}
                 <button
                    className={`p-1.5 rounded-md transition-all flex items-center gap-2 ${isLive ? 'bg-red-500/20 text-red-400' : 'bg-[#27272a] text-gray-400 hover:text-white'}`}
                    onClick={isLive ? stopLiveSession : startLiveSession}
                    title="Toggle Live Voice Mode"
                 >
                    {isLive ? <MicOff size={14} /> : <Mic size={14} />}
                    <span className="text-xs font-medium">{isLive ? 'Stop Live' : 'Go Live'}</span>
                 </button>
                 <div className="w-px h-4 bg-[#27272a] mx-1"></div>
                 <div className="flex items-center gap-2 bg-[#18181b] p-1 rounded-lg border border-[#27272a]">
                    <button 
                        className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.CHAT_ONLY ? 'bg-[#27272a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} 
                        onClick={() => setViewMode(ViewMode.CHAT_ONLY)} 
                        title="Chat Only"
                    >
                        <MessageSquare size={14} />
                    </button>
                    <button 
                        className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.SPLIT ? 'bg-[#27272a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} 
                        onClick={() => setViewMode(ViewMode.SPLIT)} 
                        title="Split View"
                    >
                        <LayoutTemplate size={14} />
                    </button>
                    <button 
                        className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.EDITOR_ONLY ? 'bg-[#27272a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} 
                        onClick={() => setViewMode(ViewMode.EDITOR_ONLY)} 
                        title="Editor Only"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Chat Panel */}
          <div className={`flex flex-col border-r border-[#27272a] transition-all duration-300 ease-in-out ${viewMode === ViewMode.EDITOR_ONLY ? 'w-0 opacity-0 hidden' : viewMode === ViewMode.CHAT_ONLY ? 'w-full' : 'w-[40%] min-w-[350px]'} `}>
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
                <div ref={messagesEndRef} />
             </div>
             
             {/* Input Area */}
             <div className="p-4 bg-[#0f0f11]">
                <div className="relative group">
                    <textarea 
                        className="w-full bg-[#1e1e20] border border-[#27272a] group-hover:border-[#3f3f46] rounded-xl pl-4 pr-12 py-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none shadow-lg"
                        rows={isSidebarOpen ? 3 : 1} 
                        style={{ minHeight: '60px', maxHeight: '200px' }}
                        placeholder={isLoading ? "Nexus is thinking..." : isLive ? "Listening... Speak now." : "Ask Nexus to edit files, generate code, or explain logic..."}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        disabled={isLoading || isLive}
                    />
                    <button 
                        className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all duration-200 ${inputValue.trim() && !isLoading && !isLive ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-md' : 'text-gray-600 cursor-not-allowed bg-transparent'}`}
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading || isLive}
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} />}
                    </button>
                </div>
                <div className="mt-2 flex justify-center gap-4 text-[10px] text-gray-600">
                    <span className={isLive ? "text-green-500 font-bold" : ""}>{isLive ? "Gemini 2.5 Native Audio" : "Gemini 2.5 Flash"}</span>
                    <span>•</span>
                    <span>Gemini 3 Pro (Reasoning)</span>
                </div>
             </div>
          </div>

          {/* Editor Panel */}
          <div className={`flex-1 bg-[#0f0f11] transition-all duration-300 ${viewMode === ViewMode.CHAT_ONLY ? 'hidden' : 'block'}`}>
            <Editor 
                file={activeFile} 
                onChange={(newContent) => {
                    if (activeFile) {
                        setFiles(files.map(f => f.path === activeFile.path ? { ...f, content: newContent } : f));
                        setActiveFile({ ...activeFile, content: newContent });
                    }
                }} 
            />
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;