/**
 * /api/form — accepts JSON from any site form, validates anti-spam, sends via Resend.
 *
 * Env vars set on the Cloudflare Pages project (NOT in repo):
 *   - RESEND_API_KEY            (secret, send-only scope)
 *   - SMTP_FROM_ADDRESS         e.g. noreply@bmgidx.com
 *   - CONTACT_TO_ADDRESS        e.g. info@evolutionaryk9.com
 *   - SITE_NAME                 e.g. "Evolutionary K9"
 *   - TURNSTILE_SECRET_KEY      (optional) — when set, every submission must include
 *                               a valid cf-turnstile-response and pass /siteverify.
 *
 * Anti-spam stack (in order):
 *   1. Honeypot field — `website` must be empty (humans can't see it; bots will fill it).
 *   2. Submit-time check — form rendered timestamp `ts` must be at least 2 seconds before
 *      submission (bots typically submit instantly).
 *   3. Cloudflare Turnstile — server verifies the token via /siteverify when enabled.
 *   4. Resend's own rate limiting handles the last mile.
 */

interface Env {
  RESEND_API_KEY: string;
  SMTP_FROM_ADDRESS: string;
  CONTACT_TO_ADDRESS: string;
  SITE_NAME: string;
  TURNSTILE_SECRET_KEY?: string;
}

const ALLOWED_KEYS = new Set([
  'form_id', 'form_label', 'name', 'email', 'phone',
  'dog_names', 'dog_count', 'dog_ages', 'dates', 'preferred_days',
  'help_with', 'message', 'how_heard',
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function onRequestPost(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx;

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // 1. Honeypot
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return json({ message: 'Thanks — we will be in touch.' }, 200); // silent OK for bots
  }

  // 2. Min-fill-time (bots submit instantly)
  const tsNum = Number(body.ts);
  if (!Number.isFinite(tsNum) || Date.now() - tsNum < 2000) {
    return json({ error: 'Form submitted too quickly. Please try again.' }, 400);
  }

  // 3. Required fields
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  if (!name) return json({ error: 'Please enter your name.' }, 400);
  if (!email || !isLikelyEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  // 4. Turnstile (when configured)
  if (env.TURNSTILE_SECRET_KEY) {
    const token = (body as any)['cf-turnstile-response'];
    if (!token) return json({ error: 'Please complete the security check.' }, 400);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }).toString(),
    });
    const verifyData = await verify.json() as { success?: boolean };
    if (!verifyData.success) return json({ error: 'Security check failed. Please try again.' }, 400);
  }

  // Build the email
  const formLabel = (body.form_label || body.form_id || 'Website form').toString();
  const fields = Object.entries(body)
    .filter(([k, v]) => ALLOWED_KEYS.has(k) && typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => ({ key: k, value: String(v).trim() }));

  const textBody = [
    `New ${formLabel} from ${env.SITE_NAME} website`,
    '',
    ...fields.map((f) => `${f.key}: ${f.value}`),
    '',
    `Reply directly to this email to respond to ${name}.`,
  ].join('\n');

  const htmlBody = [
    `<h2 style="font-family:sans-serif;">New ${escapeHtml(formLabel)}</h2>`,
    `<p style="font-family:sans-serif;color:#555;">From the ${escapeHtml(env.SITE_NAME)} website.</p>`,
    `<table style="font-family:sans-serif;border-collapse:collapse;margin-top:16px;">`,
    ...fields.map((f) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;"><strong>${escapeHtml(f.key)}</strong></td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(f.value)}</td></tr>`,
    ),
    `</table>`,
    `<p style="font-family:sans-serif;color:#555;margin-top:24px;">Reply directly to this email to respond.</p>`,
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${env.SITE_NAME} Website <${env.SMTP_FROM_ADDRESS}>`,
        to: [env.CONTACT_TO_ADDRESS],
        reply_to: email,
        subject: `[${env.SITE_NAME}] ${formLabel} — ${name}`,
        text: textBody,
        html: htmlBody,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Resend send failed', res.status, errText);
      return json({ error: 'Unable to send right now. Please call 770-733-2621.' }, 502);
    }
  } catch (err) {
    console.error('Resend error', err);
    return json({ error: 'Unable to send right now. Please call 770-733-2621.' }, 502);
  }

  return json({ message: 'Thank you! Your request has been submitted. We will be in touch within 24 hours.' }, 200);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
