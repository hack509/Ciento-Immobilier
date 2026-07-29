import { getEnv } from '@/lib/env';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

export class GeminiService {
  private proxyUrl: string;
  private history: GeminiMessage[] = [];

  constructor() {
    this.proxyUrl = getEnv().geminiProxyUrl;
  }

  isConfigured(): boolean {
    return true;
  }

  async sendMessage(userMessage: string): Promise<string> {
    this.history.push({ role: 'user', parts: userMessage });

    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: this.history.slice(0, -1),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Gemini proxy error:', errorData);
        this.history.pop();
        return "Désolé, une erreur est survenue avec le service IA. Veuillez réessayer.";
      }

      const data = await response.json();
      const text = data.text;

      if (!text) {
        this.history.pop();
        return "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
      }

      this.history.push({ role: 'model', parts: text });
      return text;
    } catch (error) {
      console.error('Gemini proxy error:', error);
      this.history.pop();
      return "Désolé, une erreur de connexion est survenue. Vérifiez votre connexion internet et réessayez.";
    }
  }

  clearHistory() {
    this.history = [];
  }
}

export const geminiService = new GeminiService();
