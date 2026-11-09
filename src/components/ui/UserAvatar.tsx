import { useState } from 'react';
import { cn } from '@/lib/utils';

const sizes = { xs: 'h-8 w-8 text-xs', sm: 'h-10 w-10 text-sm', md: 'h-14 w-14 text-base', lg: 'h-24 w-24 text-2xl' };

/** Profile photo with initials fallback (also used when the image fails to load). */
export function UserAvatar({ firstName, lastName, url, size = 'sm', className }: {
  firstName?: string | null; lastName?: string | null; url?: string | null; size?: keyof typeof sizes; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  if (url && !failed) {
    return (
      <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-white', sizes[size], className)} />
    );
  }
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-blue font-semibold text-white', sizes[size], className)}>
      {initials}
    </span>
  );
}
