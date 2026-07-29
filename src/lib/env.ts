interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  appName: string;
  geminiProxyUrl: string;
}

function getEnvVar(name: string, fallback = ''): string {
  return (import.meta.env[name] as string | undefined) || fallback;
}

let cached: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cached) return cached;

  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[env] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase credentials.'
    );
  }

  cached = {
    supabaseUrl,
    supabaseAnonKey,
    appUrl: getEnvVar('VITE_APP_URL', 'http://localhost:5173'),
    appName: getEnvVar('VITE_APP_NAME', 'Ciento-Immobilier'),
    geminiProxyUrl: getEnvVar('VITE_GEMINI_PROXY_URL', '/api/gemini-proxy'),
  };
  return cached;
}

export function isEnvConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
