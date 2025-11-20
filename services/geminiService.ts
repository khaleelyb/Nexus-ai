import { GoogleGenAI, FunctionDeclaration, Type, Chat, Part, LiveServerMessage, Modality } from "@google/genai";
import { MODEL_PRO, MODEL_FLASH, DEFAULT_SYSTEM_INSTRUCTION } from "../constants";

// --- Tool Definitions ---

const createFileTool: FunctionDeclaration = {
  name: "createFile",
  parameters: {
    type: Type.OBJECT,
    description: "Create a new file in the virtual file system. Do not use this for files that already exist.",
    properties: {
      path: { type: Type.STRING, description: "The file path (e.g., components/Button.tsx)" },
      content: { type: Type.STRING, description: "The full content of the file" },
    },
    required: ["path", "content"],
  },
};

const updateFileTool: FunctionDeclaration = {
  name: "updateFile",
  parameters: {
    type: Type.OBJECT,
    description: "Update an existing file in the virtual file system. Overwrites the entire file.",
    properties: {
      path: { type: Type.STRING, description: "The file path to update" },
      content: { type: Type.STRING, description: "The new full content of the file" },
    },
    required: ["path", "content"],
  },
};

const listFilesTool: FunctionDeclaration = {
  name: "listFiles",
  parameters: {
    type: Type.OBJECT,
    description: "List all files currently in the virtual file system.",
    properties: {},
  },
};

const readFileTool: FunctionDeclaration = {
  name: "readFile",
  parameters: {
    type: Type.OBJECT,
    description: "Read the content of a specific file.",
    properties: {
      path: { type: Type.STRING, description: "The file path to read" }
    },
    required: ["path"],
  },
};

const deleteFileTool: FunctionDeclaration = {
  name: "deleteFile",
  parameters: {
    type: Type.OBJECT,
    description: "Delete a file from the virtual file system.",
    properties: {
      path: { type: Type.STRING, description: "The path of the file to delete" }
    },
    required: ["path"],
  },
};

const moveFileTool: FunctionDeclaration = {
  name: "moveFile",
  parameters: {
    type: Type.OBJECT,
    description: "Move or rename a file.",
    properties: {
      oldPath: { type: Type.STRING, description: "The current file path" },
      newPath: { type: Type.STRING, description: "The new file path" }
    },
    required: ["oldPath", "newPath"],
  },
};

// --- Service Class ---

export class GeminiService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private modelId: string;

  constructor(apiKey: string, modelId: string = MODEL_PRO) {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelId = modelId;
  }

  public startChat() {
    this.chatSession = this.ai.chats.create({
      model: this.modelId,
      config: {
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        tools: [
            { functionDeclarations: [createFileTool, updateFileTool, listFilesTool, readFileTool, deleteFileTool, moveFileTool] },
            { googleSearch: {} }
        ],
        thinkingConfig: this.modelId.includes('gemini-3') ? { thinkingBudget: 2048 } : undefined
      },
    });
  }

  public async sendMessage(
    message: string, 
    toolExecutor: (name: string, args: any) => Promise<any>
  ): Promise<string> {
    if (!this.chatSession) {
      this.startChat();
    }

    // First turn
    let result = await this.chatSession!.sendMessage({ message });
    
    // Loop for tool calls (Agentic behavior)
    const maxTurns = 10;
    let turns = 0;

    while (result.functionCalls && result.functionCalls.length > 0 && turns < maxTurns) {
      turns++;
      const parts: Part[] = [];

      for (const call of result.functionCalls) {
        console.log(`[GeminiService] Executing tool: ${call.name}`);
        try {
          const toolResult = await toolExecutor(call.name, call.args);
          parts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: toolResult },
            }
          });
        } catch (error: any) {
          parts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { error: error.message },
            }
          });
        }
      }

      // Send tool responses back to the model
      if (parts.length > 0) {
        result = await this.chatSession!.sendMessage({ message: parts });
      }
    }

    return result.text || "";
  }

  public async connectLive(callbacks: {
    onopen: () => void;
    onmessage: (msg: LiveServerMessage) => void;
    onclose: (e: CloseEvent) => void;
    onerror: (e: ErrorEvent) => void;
  }): Promise<any> {
      // Use the specialized Native Audio model for Live
      return this.ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks,
          config: {
              systemInstruction: DEFAULT_SYSTEM_INSTRUCTION + "\n You are in Live Voice Mode. Keep answers shorter and more conversational.",
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
              },
              tools: [
                  { functionDeclarations: [createFileTool, updateFileTool, listFilesTool, readFileTool, deleteFileTool, moveFileTool] },
                  { googleSearch: {} }
              ]
          }
      });
  }
}