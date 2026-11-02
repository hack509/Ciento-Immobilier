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
└── migrations/        # Database migrations
    ├── 001-007        # Core schema (extensions, enums, tables, indexes, RLS, functions, seed)
    ├── 008-009        # Newsletter feature
    ├── 010-013        # Storage, profile creation, security fixes, messaging RPCs
    └── 014            # Security hardening for deployed projects
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

For a new project, apply the migrations in order:

```bash
# Link to your Supabase project
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push

# Verify
npx supabase db dump --file schema.sql
```

The project reference in `supabase/config.toml` should match the project URL
in `.env`. Before applying migrations, verify which migrations have already
been run on that exact project. If migrations `001`-`013` were already applied
there, do not run them again; apply only
[`014_security_hardening.sql`](supabase/migrations/014_security_hardening.sql).
If this is a different/new project, apply all migrations in order instead.
Deploy the updated frontend before making the property image bucket private,
so it can request signed image URLs.

The unsubscribe token issuer is restricted to `service_role`; a trusted
server-side email workflow issues and delivers confirmation/unsubscribe
tokens. The Edge Functions use Resend; configure `RESEND_API_KEY` and
`NEWSLETTER_FROM_EMAIL` as Supabase Function secrets, never in the browser:

```bash
npx supabase secrets set RESEND_API_KEY=<your-resend-api-key> NEWSLETTER_FROM_EMAIL="Ciento-Immobilier <newsletter@your-domain>"
npx supabase functions deploy newsletter-subscribe
npx supabase functions deploy newsletter-manage
```

The sender domain must be verified with Resend. The API rate-limits newsletter
requests to three per email per day and ten per client IP per hour.

## Environment Variables

See [.env.example](.env.example) for all required variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_APP_URL` | No | App URL for emails/SEO |
| `VITE_APP_NAME` | No | App display name |

## Deployment

### Vercel

1. Push repo to GitHub
2. Import project in Vercel
3. Framework: Vite
4. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
5. Deploy

### Supabase

1. Run migrations: `npx supabase db push`
