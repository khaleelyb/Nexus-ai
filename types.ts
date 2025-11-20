export interface VirtualFile {
  name: string;
  content: string;
  language: string;
  path: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  isThinking?: boolean;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  name: string;
  args: any;
  result?: string;
}

export enum ViewMode {
  CHAT_ONLY = 'chat_only',
  SPLIT = 'split',
  EDITOR_ONLY = 'editor_only'
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}
