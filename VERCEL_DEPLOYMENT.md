# Vercel Deployment Guide — Ciento-Immobilier

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (vercel.com)
- Supabase project with migrations applied
- Gemini API key (for chatbot)

---

## Step-by-Step

### 1. Create a Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `ciento-immobilier` from your GitHub repos

### 2. Configure Project

| Setting | Value |
|---------|-------|
| Framework Preset | **Vite** (auto-detected) |
| Root Directory | `./` (default) |
| Build Command | `npm run build` (auto-detected) |
| Output Directory | `dist` (auto-detected) |
| Install Command | `npm install` (auto-detected) |
| Node Version | **22.x** (default) |

### 3. Configure Environment Variables

Add the following environment variables in the Vercel dashboard:

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `VITE_SUPABASE_URL` | Yes | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase Dashboard → Settings → API → anon/public key |
| `VITE_APP_URL` | No | Your Vercel deployment URL (e.g., `https://ciento-immobilier.vercel.app`) |
| `VITE_APP_NAME` | No | `Ciento-Immobilier` |
| `VITE_GEMINI_PROXY_URL` | No | Defaults to `/api/gemini-proxy` (handled by Supabase) |

Set them for all three environments: **Development**, **Preview**, **Production**.

### 4. Deploy

1. Click **Deploy**
2. Wait for the build to complete (~1 min)
3. Your site is live at `https://ciento-immobilier.vercel.app`

### 5. Custom Domain (Optional)

1. Go to Project → Domains
2. Add your custom domain (e.g., `ciento-immobilier.com`)
3. Follow Vercel's DNS instructions

---

## Supabase Setup (Required)

### Database Migrations

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Edge Function (Gemini Chatbot)

```bash
# Deploy the function
npx supabase functions deploy gemini-proxy

# Set the Gemini API key as a secret
npx supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

### Storage Buckets

Migration `010_create_storage_buckets.sql` creates the `property-images` bucket automatically during `npx supabase db push`.

---

## Environment Variables Reference

| Variable | Development | Preview | Production | Required | Description |
|----------|-------------|---------|------------|----------|-------------|
| `VITE_SUPABASE_URL` | Local `.env` | Vercel Dashboard | Vercel Dashboard | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Local `.env` | Vercel Dashboard | Vercel Dashboard | Yes | Supabase anon key |
| `VITE_APP_URL` | `http://localhost:5173` | Preview URL | Production URL | No | App URL |
| `VITE_APP_NAME` | `Ciento-Immobilier` | `Ciento-Immobilier` | `Ciento-Immobilier` | No | Display name |
| `VITE_GEMINI_PROXY_URL` | `/api/gemini-proxy` | `/api/gemini-proxy` | `/api/gemini-proxy` | No | Gemini proxy URL |
| `GEMINI_API_KEY` | Supabase secret | Supabase secret | Supabase secret | Yes* | Gemini API key |

> *`GEMINI_API_KEY` is only required if using the AI ChatBot feature.

---

## Rollback

```bash
# Vercel: Go to Deployment → ⚙️ → Rollback to Previous
# Supabase: npx supabase db push --target <previous-migration>
```

---

## Health Check

After deployment, verify:

- [ ] Home page loads at custom domain
- [ ] All routes work (including direct URL access)
- [ ] Authentication (login/register/reset password)
- [ ] Property listing and detail pages load
- [ ] Dashboard pages load correctly
- [ ] ChatBot responds (if configured)
- [ ] Forms submit and validate
- [ ] Images load and upload works
- [ ] 404 page shows for unknown routes
- [ ] SEO meta tags present in page source
- [ ] No CORS errors in browser console
