import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

/**
 * Sends a GA4 page_view on every SPA navigation (only when the GA tag was
 * injected at build time via VITE_GA_MEASUREMENT_ID). Query strings are not
 * sent: they may contain search terms or tokens.
 */
export function Analytics() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', { page_path: location.pathname, page_location: window.location.origin + location.pathname, page_title: document.title });
  }, [location.pathname]);
  return null;
}
