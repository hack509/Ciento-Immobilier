import { useState } from 'react';
import { newsletterService } from '@/services/newsletter.service';

export function useSubscribeNewsletter() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const subscribe = async (email: string, source = 'footer') => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await newsletterService.subscribe(email, source);
      setResult(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  return { subscribe, isLoading, result };
}
