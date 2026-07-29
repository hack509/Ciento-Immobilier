interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  appName: string;
  geminiProxyUrl: string;
}

function requireEnv(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `  Please set ${name} in your .env file.\n` +
      `  See .env.example for reference.`
    );
  }
  return value;
}

let cached: EnvConfig | null = null;
let validationError: Error | null = null;

export function getEnv(): EnvConfig {
  if (cached) return cached;
  if (validationError) throw validationError;

  try {
    cached = {
      supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
      supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
      appUrl: import.meta.env.VITE_APP_URL as string || 'http://localhost:5173',
      appName: (import.meta.env.VITE_APP_NAME as string) || 'Ciento-Immobilier',
      geminiProxyUrl: (import.meta.env.VITE_GEMINI_PROXY_URL as string) || '/api/gemini-proxy',
    };
    return cached;
  } catch (e) {
    validationError = e instanceof Error ? e : new Error('Environment validation failed');
    throw validationError;
  }
}

export function isEnvConfigured(): boolean {
  try {
    getEnv();
    return true;
  } catch {
    return false;
  }
}
