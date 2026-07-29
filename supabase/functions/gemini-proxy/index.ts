import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

interface RequestBody {
  message: string;
  history?: ChatMessage[];
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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured on the server.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body: RequestBody = await req.json();
    if (!body.message || typeof body.message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a string.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n---\n\nConversation en cours :' }] },
      ...(body.history || []).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })),
      { role: 'user', parts: [{ text: body.message }] },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
      return new Response(
        JSON.stringify({ error: 'Le service IA est temporairement indisponible.' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Aucune réponse générée.' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Une erreur interne est survenue.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
