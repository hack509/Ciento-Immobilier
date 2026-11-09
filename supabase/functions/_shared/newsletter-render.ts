// Newsletter rendering shared by the admin preview (React) and the sender
// (Edge Function). Admins write a small, safe Markdown subset; everything is
// HTML-escaped first, so campaign content can never inject markup or scripts.
//
// Supported: "# Titre", "## Sous-titre", **gras**, *italique*, [texte](https://lien),
// "- élément de liste", paragraphs separated by an empty line.

export const BRAND = {
  name: 'CIENTO-IMMOBILIER',
  blue: '#1D3E91',
  yellow: '#F4D000',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text: string): string {
  let out = escapeHtml(text);
  // Links: only https URLs (escaped already, so quotes cannot break the attribute).
  out = out.replace(/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500})\)/g,
    (_m, label: string, url: string) => `<a href="${url}" style="color:${BRAND.blue};font-weight:600">${label}</a>`);
  out = out.replace(/\*\*([^*]{1,500})\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]{1,500})\*/g, '$1<em>$2</em>');
  return out;
}

/** Converts the restricted Markdown body to email-safe HTML blocks. */
export function renderNewsletterBody(markdown: string): string {
  const blocks = markdown.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      const items = lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('');
      return `<ul style="padding-left:20px;margin:0 0 16px">${items}</ul>`;
    }
    if (block.startsWith('## ')) return `<h2 style="font-size:18px;margin:24px 0 8px;color:${BRAND.blue}">${inline(block.slice(3))}</h2>`;
    if (block.startsWith('# ')) return `<h1 style="font-size:22px;margin:0 0 12px;color:${BRAND.blue}">${inline(block.slice(2))}</h1>`;
    return `<p style="margin:0 0 16px;line-height:1.6">${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');
}

export interface NewsletterEmail {
  subject: string;
  preheader?: string | null;
  content: string;
  unsubscribeUrl: string;
  siteUrl: string;
}

/** Full branded HTML document (table layout for email clients). */
export function renderNewsletterHtml(email: NewsletterEmail): string {
  const pre = email.preheader ? escapeHtml(email.preheader) : '';
  const site = escapeHtml(email.siteUrl);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(email.subject)}</title></head>
<body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<span style="display:none;max-height:0;overflow:hidden">${pre}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${BRAND.blue};padding:20px 28px;border-bottom:4px solid ${BRAND.yellow}">
<a href="${site}" style="color:#ffffff;text-decoration:none;font-size:20px;font-weight:800;letter-spacing:.5px">${BRAND.name}</a></td></tr>
<tr><td style="padding:28px">${renderNewsletterBody(email.content)}</td></tr>
<tr><td style="padding:20px 28px;background:#f9fafb;font-size:12px;color:#6b7280;line-height:1.5">
Vous recevez cet e-mail car vous êtes inscrit à la newsletter ${BRAND.name}.<br>
<a href="${escapeHtml(email.unsubscribeUrl)}" style="color:#6b7280">Se désinscrire</a> · <a href="${site}" style="color:#6b7280">${site.replace(/^https?:\/\//, '')}</a>
</td></tr></table></td></tr></table></body></html>`;
}

/** Plain-text alternative (better deliverability). */
export function renderNewsletterText(email: NewsletterEmail): string {
  const text = email.content
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#+\s+/gm, '');
  return `${text}\n\n—\n${BRAND.name} · ${email.siteUrl}\nSe désinscrire : ${email.unsubscribeUrl}`;
}
