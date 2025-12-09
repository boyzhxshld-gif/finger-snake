import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { FingerPosition } from '../types';

interface GeminiLiveConfig {
  onFingerMove: (pos: FingerPosition) => void;
  onStatusChange: (status: string) => void;
  onError: (error: string) => void;
}

// Tool definition for updating finger position
const updateFingerPositionTool: FunctionDeclaration = {
  name: 'updateFingerPosition',
  parameters: {
    type: Type.OBJECT,
    description: 'Update the coordinates of the user\'s index finger tip detected in the video stream.',
    properties: {
      x: {
        type: Type.NUMBER,
        description: 'The normalized X coordinate (0.0 to 1.0) of the finger tip. 0 is left, 1 is right.',
      },
      y: {
        type: Type.NUMBER,
        description: 'The normalized Y coordinate (0.0 to 1.0) of the finger tip. 0 is top, 1 is bottom.',
      },
    },
    required: ['x', 'y'],
  },
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private config: GeminiLiveConfig;
  private isConnected = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect() {
    try {
      this.config.onStatusChange('正在连接 Gemini...');
      
      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.config.onStatusChange('已连接。追踪生效中。');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'updateFingerPosition') {
                  const { x, y } = fc.args as { x: number; y: number };
                  this.config.onFingerMove({ x, y, isActive: true });
                  
                  // Must respond to tool calls
                  sessionPromise.then((session: any) => {
                     session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "ok" },
                      }
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            this.isConnected = false;
            this.config.onStatusChange('已断开');
          },
          onerror: (e: any) => {
            console.error(e);
            this.isConnected = false;
            this.config.onError('连接错误');
            this.config.onStatusChange('错误');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO], // Required by API even if we only want tools
          tools: [{ functionDeclarations: [updateFingerPositionTool] }],
          systemInstruction: `
            You are a real-time vision tracker for a game. 
            Your task is to analyze the video stream and continuously locate the tip of the user's index finger.
            When you see a finger, IMMEDIATELY call the 'updateFingerPosition' tool with the normalized X and Y coordinates (0.0 to 1.0).
            Do not speak. Just track the finger. 
            If the hand is moving, predict where it is.
            Prioritize speed.
          `,
        }
      });

      this.session = await sessionPromise;

    } catch (error: any) {
      this.config.onError(error.message);
      this.config.onStatusChange('连接失败');
    }
  }

  async sendFrame(base64Data: string) {
    if (this.session && this.isConnected) {
      try {
        await this.session.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      } catch (e) {
        console.error("Error sending frame", e);
      }
    }
  }

  disconnect() {
    // There is no explicit disconnect method on the session object in the current SDK snippet,
    // but we can close the implicit websocket if exposed, or just nullify.
    // The documentation mentions session.close() in the rules section.
    if (this.session) {
      // Try catch in case close isn't fully implemented in the type definition yet
      try {
        (this.session as any).close();
      } catch (e) { 
        console.warn("Could not close session explicitly", e);
      }
      this.session = null;
    }
    this.isConnected = false;
    this.config.onStatusChange('已断开');
  }
}

// Helper for blob to base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove data url prefix
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};