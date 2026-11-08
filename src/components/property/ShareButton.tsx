import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Native share sheet when available (mobile), otherwise copies the link. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  };

  return (
    <Button variant="ghost" className="w-full" onClick={share} icon={copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}>
      {copied ? 'Lien copié' : 'Partager'}
    </Button>
  );
}
