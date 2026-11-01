import { supabase } from './supabase';

export class NewsletterService {
  async subscribe(email: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase.functions.invoke('newsletter-subscribe', {
      body: { email: email.toLowerCase().trim() },
    });

    if (error) {
      return { success: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
    }

    return {
      success: true,
      message: 'Vérifiez votre boîte e-mail pour confirmer ou gérer votre inscription.',
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
