import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { buildRobots, normalizeSiteUrl } from './src/lib/seo-core.ts';

/**
 * SEO at build time:
 *  - robots.txt generated with the real domain (VITE_APP_URL)
 *  - Google Search Console / Bing verification meta tags (optional env)
 *  - Google Analytics 4 tag (optional env, page views sent by <Analytics />)
 */
function seoPlugin(env: Record<string, string>): Plugin {
  const siteUrl = normalizeSiteUrl(env.VITE_APP_URL);
  const google = env.VITE_GOOGLE_SITE_VERIFICATION?.replace(/[^A-Za-z0-9_-]/g, '');
  const bing = env.VITE_BING_SITE_VERIFICATION?.replace(/[^A-Za-z0-9_-]/g, '');
  const ga = /^G-[A-Z0-9]{4,20}$/.test(env.VITE_GA_MEASUREMENT_ID ?? '') ? env.VITE_GA_MEASUREMENT_ID : '';
  return {
    name: 'ciento-seo',
    transformIndexHtml(html) {
      const tags = [
        google ? `<meta name="google-site-verification" content="${google}" />` : '',
        bing ? `<meta name="msvalidate.01" content="${bing}" />` : '',
        ga ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}',{send_page_view:false,anonymize_ip:true});</script>` : '',
      ].filter(Boolean).join('\n    ');
      // Social crawlers need absolute image URLs.
      const withAbsoluteOg = html.replace('content="/og-image.jpg"', `content="${siteUrl}/og-image.jpg"`);
      return tags ? withAbsoluteOg.replace('</head>', `    ${tags}\n  </head>`) : withAbsoluteOg;
    },
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(buildRobots(siteUrl));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(siteUrl) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seoPlugin(loadEnv(mode, process.cwd(), 'VITE_'))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react')) {
            return 'ui';
          }
          if (id.includes('node_modules/@tanstack') || id.includes('node_modules/axios')) {
            return 'data';
          }
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod') || id.includes('node_modules/@hookform')) {
            return 'forms';
          }
        },
      },
    },
  },
}));
