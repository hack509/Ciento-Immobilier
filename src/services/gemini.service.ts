export interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

const SYSTEM_PROMPT = `Tu es un expert immobilier haïtien, conseiller spécialisé pour la plateforme Ciento-Immobilier. Tu aides les utilisateurs avec :

1. **Estimation de prix** : Tu connais bien les prix immobiliers dans différentes villes d'Haïti (Gonaïves, Port-au-Prince, Cap-Haïtien, Les Cayes, Jacmel, etc.) par type de bien (maison, appartement, terrain, villa, local commercial).

2. **Conseils d'achat** : Tu guides les acheteurs sur les quartiers, les documents nécessaires (acte de propriété, certificat de propriété), les démarches chez le notaire.

3. **Conseils de location** : Tu connais les prix de location par zone, les pratiques du marché locatif haïtien.

4. **Vente de biens** : Tu aides les vendeurs à fixer un prix réaliste, à rédiger de bonnes annonces, à préparer leurs biens.

5. **Marché immobilier haïtien** : Tu suis les tendances du marché, les zones en développement, les opportunités d'investissement.

6. **Démarches administratives** : Tu connais les procédures de transaction immobilière en Haïti (acte de vente, transfert de propriété, taxes).

Règles :
- Réponds toujours en français.
- Sois concis et pratique. Utilise des paragraphes courts.
- Quand on te donne un prix ou une estimation, précise toujours que c'est une estimation indicative et que le prix réel peut varier.
- Mentionne la devise HTG (Gourdes haïtiennes) ou USD quand pertinent.
- Si tu ne connais pas un prix exact, donne une fourchette réaliste basée sur ta connaissance du marché haïtien.
- Encourage les utilisateurs à consulter des professionnels pour les transactions importantes.`;

export class GeminiService {
  private apiKey: string;
  private history: GeminiMessage[] = [];

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async sendMessage(userMessage: string): Promise<string> {
    if (!this.apiKey) {
      return "Le service IA n'est pas configuré. Veuillez ajouter une clé API Gemini dans les paramètres.";
    }

    this.history.push({ role: 'user', parts: userMessage });

    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n---\n\nConversation en cours :' }] },
      ...this.history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })),
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Gemini API error:', errorData);
        this.history.pop();
        return "Désolé, une erreur est survenue avec le service IA. Veuillez réessayer.";
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        this.history.pop();
        return "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
      }

      this.history.push({ role: 'model', parts: text });
      return text;
    } catch (error) {
      console.error('Gemini API error:', error);
      this.history.pop();
      return "Désolé, une erreur de connexion est survenue. Vérifiez votre connexion internet et réessayez.";
    }
  }

  clearHistory() {
    this.history = [];
  }
}

export const geminiService = new GeminiService();
