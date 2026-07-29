# Gemini Proxy Edge Function Deployment

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Supabase project linked (`supabase link`)

## Environment Variables (Supabase Secrets)

Set the Gemini API key as a Supabase Secret (never in code):

```bash
supabase secrets set GEMINI_API_KEY=your-actual-gemini-api-key
```

To verify:
```bash
supabase secrets list
```

## Local Development

1. Start local Supabase:
```bash
supabase start
```

2. Serve the function locally:
```bash
supabase functions serve gemini-proxy --env-file .env.local
```

3. The function will be available at:
```
http://localhost:54321/functions/v1/gemini-proxy
```

4. Set `VITE_GEMINI_PROXY_URL` in your `.env`:
```
VITE_GEMINI_PROXY_URL=http://localhost:54321/functions/v1/gemini-proxy
```

## Production Deployment

```bash
supabase functions deploy gemini-proxy --no-verify-jwt
```

After deployment, the function is available at:
```
https://[project-ref].supabase.co/functions/v1/gemini-proxy
```

Set the production `VITE_GEMINI_PROXY_URL` in your hosting environment.

## Security Notes
- `verify_jwt = false` is set because the chatbot is publicly accessible.
- Rate limiting should be configured at the Supabase project level.
- The Gemini API key is stored as a Supabase Secret, never in code.
- All API calls to Google Gemini originate from the Supabase server, not client browsers.
