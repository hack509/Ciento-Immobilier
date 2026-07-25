import { supabase } from './supabase';

export class NewsletterService {
  async subscribe(email: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'Cet email est déjà abonné à notre newsletter.' };
      }
      return { success: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
    }

    return { success: true, message: 'Merci ! Vous êtes maintenant abonné à notre newsletter.' };
  }

  async unsubscribe(email: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq('email', email.toLowerCase().trim());

    if (error) {
      return { success: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
    }

    return { success: true, message: 'Vous avez été désabonné de notre newsletter.' };
  }
}

export const newsletterService = new NewsletterService();
