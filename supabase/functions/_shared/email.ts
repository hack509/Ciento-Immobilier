// Email provider abstraction (Resend, Brevo). Pure TypeScript; the network
// layer is injectable for tests. SMTP is not available from Edge Functions
// (no raw TCP sockets on every plan): use an SMTP relay's HTTP API instead.

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: 'resend' | 'brevo';
  sendBatch(emails: OutgoingEmail[]): Promise<SendResult[]>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: Fetch = (input, init) => fetch(input, init);

export interface EmailConfig {
  provider: 'resend' | 'brevo';
  apiKey: string;
  from: string;
  fromName: string;
  replyTo?: string;
}

/** Reads the provider from the environment; null = no provider configured (never pretend to send). */
export function readEmailConfig(env: Record<string, string | undefined>): EmailConfig | null {
  const from = env.EMAIL_FROM || env.NEWSLETTER_FROM_EMAIL;
  const fromName = env.EMAIL_FROM_NAME || 'CIENTO-IMMOBILIER';
  const replyTo = env.EMAIL_REPLY_TO || undefined;
  const wanted = (env.EMAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : env.BREVO_API_KEY ? 'brevo' : '')).toLowerCase();
  if (!from) return null;
  if (wanted === 'resend' && env.RESEND_API_KEY) return { provider: 'resend', apiKey: env.RESEND_API_KEY, from, fromName, replyTo };
  if (wanted === 'brevo' && env.BREVO_API_KEY) return { provider: 'brevo', apiKey: env.BREVO_API_KEY, from, fromName, replyTo };
  return null;
}

export class ResendProvider implements EmailProvider {
  readonly name = 'resend' as const;
  private readonly config: EmailConfig;
  private readonly fetchImpl: Fetch;

  constructor(config: EmailConfig, fetchImpl: Fetch = defaultFetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<SendResult[]> {
    if (emails.length === 0) return [];
    const response = await this.fetchImpl('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emails.slice(0, 100).map((e) => ({
        from: `${this.config.fromName} <${this.config.from}>`,
        to: [e.to],
        subject: e.subject,
        html: e.html,
        text: e.text,
        reply_to: e.replyTo || this.config.replyTo,
        headers: e.headers,
      }))),
    });
    if (!response.ok) {
      const error = `resend_${response.status}`;
      return emails.map(() => ({ ok: false, error }));
    }
    const body = (await response.json()) as { data?: { id: string }[] };
    return emails.map((_, i) => {
      const id = body.data?.[i]?.id;
      return id ? { ok: true, messageId: id } : { ok: false, error: 'resend_missing_id' };
    });
  }
}

export class BrevoProvider implements EmailProvider {
  readonly name = 'brevo' as const;
  private readonly config: EmailConfig;
  private readonly fetchImpl: Fetch;

  constructor(config: EmailConfig, fetchImpl: Fetch = defaultFetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const e of emails) {
      const response = await this.fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': this.config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: this.config.from, name: this.config.fromName },
          to: [{ email: e.to }],
          subject: e.subject,
          htmlContent: e.html,
          textContent: e.text,
          replyTo: e.replyTo || this.config.replyTo ? { email: e.replyTo || this.config.replyTo } : undefined,
          headers: e.headers,
        }),
      });
      if (!response.ok) {
        results.push({ ok: false, error: `brevo_${response.status}` });
        continue;
      }
      const body = (await response.json()) as { messageId?: string };
      results.push(body.messageId ? { ok: true, messageId: body.messageId } : { ok: false, error: 'brevo_missing_id' });
    }
    return results;
  }
}

export function createProvider(config: EmailConfig, fetchImpl?: Fetch): EmailProvider {
  return config.provider === 'brevo' ? new BrevoProvider(config, fetchImpl) : new ResendProvider(config, fetchImpl);
}

/** RFC 8058 one-click unsubscribe headers. */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

// ---------------------------------------------------------------- Webhooks
export type EmailEvent = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';

export function mapResendEvent(type: string): EmailEvent | null {
  return ({
    'email.delivered': 'delivered', 'email.opened': 'opened', 'email.clicked': 'clicked',
    'email.bounced': 'bounced', 'email.complained': 'complained',
  } as Record<string, EmailEvent>)[type] ?? null;
}

export function mapBrevoEvent(event: string): EmailEvent | null {
  return ({
    delivered: 'delivered', opened: 'opened', unique_opened: 'opened', click: 'clicked',
    hard_bounce: 'bounced', spam: 'complained', complaint: 'complained',
  } as Record<string, EmailEvent>)[event] ?? null;
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Svix-signed webhook (Resend). Signature = base64(HMAC-SHA256(secret,
 * `${id}.${timestamp}.${body}`)); rejects messages older than 5 minutes (replay).
 */
export async function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw', base64ToBytes(secret.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${body}`));
  const expected = bytesToBase64(mac);
  return headers.signature.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    return version === 'v1' && !!sig && timingSafeEqual(sig, expected);
  });
}
