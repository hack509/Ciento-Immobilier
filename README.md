# Ciento Immobilier

Real estate platform built with React, TypeScript, and Vite. La première plateforme immobilière des Gonaïves, Haïti.

## Tech Stack

- **React 19** with hooks and functional components
- **TypeScript 6** with strict mode and `erasableSyntaxOnly`
- **Vite 8** for development server and production builds
- **TailwindCSS 4** via `@tailwindcss/vite` plugin
- **Supabase** for authentication, database, and storage
- **React Router 7** for client-side routing
- **TanStack Query 5** for server state management
- **React Hook Form + Zod 4** for form validation
- **Oxlint** for linting
- **react-helmet-async** for SEO meta tags
- **Lucide React** for icons

## Architecture

```
src/
├── components/
│   ├── auth/          # ProtectedRoute
│   ├── chatbot/       # Gemini AI chat
│   ├── layout/        # Header, Footer, PublicLayout, DashboardLayout
│   ├── seo/           # Head component (Helmet wrapper)
│   └── ui/            # Button, Card, Input, Modal, Badge, etc.
├── contexts/          # AuthContext (Supabase auth state)
├── hooks/             # TanStack Query hooks per feature
├── lib/               # Utils, env, constants, database.types
├── pages/
│   ├── auth/          # Login, Register, Forgot/Reset password
│   ├── dashboard/     # Dashboard, Properties, Messages, etc.
│   └── public/        # Home, Properties, PropertyDetail, etc.
├── providers/         # AppProviders (QueryClient, Router, Helmet, ErrorBoundary)
└── services/          # Supabase client & data access layer
supabase/
├── functions/
│   └── gemini-proxy/  # Edge Function for Gemini AI chatbot
└── migrations/        # 010 database migrations
    ├── 001-007        # Core schema (extensions, enums, tables, indexes, RLS, functions, seed)
    ├── 008-009        # Newsletter feature
    └── 010            # Storage buckets
```

## TypeScript Configuration

The project uses TypeScript 6 with project references (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`).

Key compiler options:
- **`module: "preserve"`** — Leaves imports/exports as-written for Vite to handle
- **`moduleResolution: "bundler"`** — Bundler-friendly module resolution
- **`verbatimModuleSyntax: true`** — Explicit `import type`/`export type` required
- **`erasableSyntaxOnly: true`** — Disallows runtime-emitting TS syntax (enums, namespaces)
- **`noEmit: true`** — TypeScript is only used for type-checking; Vite handles compilation
- **`paths: { "@/*": ["./src/*"] }`** — Path alias synced with Vite's `resolve.alias`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check with `tsc -b` then build with Vite |
| `npm run typecheck` | Type-check only (`tsc --noEmit`) |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview production build |

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Start dev server
npm run dev
```

## Supabase Setup

```bash
# Link to your Supabase project
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push

# Set Edge Function secrets
npx supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>

# Deploy Edge Function
npx supabase functions deploy gemini-proxy

# Verify
npx supabase db dump --file schema.sql
```

## Environment Variables

See [.env.example](.env.example) for all required variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_APP_URL` | No | App URL for emails/SEO |
| `VITE_APP_NAME` | No | App display name |
| `VITE_GEMINI_PROXY_URL` | No | Gemini Edge Function URL |
| `GEMINI_API_KEY` | Yes* | Gemini API key (Edge Function secret) |

## Deployment

### Vercel

1. Push repo to GitHub
2. Import project in Vercel
3. Framework: Vite
4. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
5. Deploy

### Supabase

1. Run migrations: `npx supabase db push`
2. Deploy Edge Function: `npx supabase functions deploy gemini-proxy`
3. Set secrets: `npx supabase secrets set GEMINI_API_KEY=<key>`
