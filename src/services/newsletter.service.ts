import { supabase } from './supabase';

export class NewsletterService {
  async subscribe(email: string, source = 'website'): Promise<{ success: boolean; message: string }> {
    const clean = email.toLowerCase().trim();
    if (clean.length > 254 || !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(clean)) {
      return { success: false, message: 'Adresse e-mail invalide.' };
    }
    const { error } = await supabase.functions.invoke('newsletter-subscribe', {
      body: { email: clean, source },
    });

    if (error) {
      const context = (error as { context?: Response }).context;
      const payload = context && typeof context.json === 'function'
        ? await context.json().catch(() => null) as { error?: string } | null : null;
      return { success: false, message: payload?.error || 'Une erreur est survenue. Veuillez réessayer.' };
    }

    return {
      success: true,
      message: 'Presque terminé ! Confirmez votre inscription grâce au lien envoyé par e-mail.',
    };
  }

  async unsubscribe(token: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('unsubscribe_newsletter', {
      p_token: token,
    });

    if (error) {
      return { success: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
    }

    if (!data) {
      return { success: false, message: 'Ce lien de désinscription est invalide ou expiré.' };
    }

    return { success: true, message: 'Vous avez été désabonné de notre newsletter.' };
  }
}

export const newsletterService = new NewsletterService();
