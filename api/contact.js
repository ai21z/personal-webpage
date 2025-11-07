import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';
import { z } from 'zod';
import validator from 'validator';

const CONTACT_SCHEMA = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(320),
  subject: z.string().min(5).max(60),
  message: z.string().min(10).max(350),
  turnstileToken: z.string().min(1).max(2048),
  honeypot: z.string().optional().transform((value) => (value || '').trim())
});

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_SIZE = 16 * 1024; // 16KB hard limit

const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = redisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: 'contact'
    })
  : null;

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.CONTACT_FROM_EMAIL;
const resendTo = (process.env.CONTACT_TARGET_EMAIL || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

function respond(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

async function verifyTurnstile(token, ipAddress) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error('TURNSTILE_NOT_CONFIGURED');
  }

  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ipAddress) {
    form.append('remoteip', ipAddress);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw new Error(`TURNSTILE_HTTP_${response.status}`);
  }

  const data = await response.json();
  return data;
}

function sanitizeLine(value) {
  return validator
    .stripLow(value || '', true)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeMessage(value) {
  return validator
    .stripLow(value || '', true)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function escapeHtml(value) {
  return validator.escape(value || '');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method Not Allowed' });
  }

  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      return respond(res, 413, { error: 'Payload too large' });
    }
    return respond(res, 400, { error: 'Unable to read request body' });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody || '{}');
  } catch (error) {
    return respond(res, 400, { error: 'Invalid JSON payload' });
  }

  const validation = CONTACT_SCHEMA.safeParse(parsed);
  if (!validation.success) {
    return respond(res, 422, { error: 'Invalid contact request' });
  }

  const data = validation.data;

  if (data.honeypot) {
    console.info('[contact] honeypot triggered — discarding payload');
    return respond(res, 200, { success: true });
  }

  const ipAddress = getClientIp(req);
  const emailKey = `email:${data.email.toLowerCase()}`;
  const ipKey = ipAddress ? `ip:${ipAddress}` : null;

  if (ratelimit) {
    const keysToCheck = [emailKey];
    if (ipKey) keysToCheck.push(ipKey);

    try {
      for (const key of keysToCheck) {
        const result = await ratelimit.limit(key);
        if (!result.success) {
          return respond(res, 429, {
            error: 'Too many messages received. Please wait a few minutes and try again.'
          });
        }
      }
    } catch (error) {
      console.error('[contact] rate limiter unavailable', error);
      return respond(res, 503, { error: 'Rate limit service unavailable. Please retry later.' });
    }
  }

  try {
    const turnstile = await verifyTurnstile(data.turnstileToken, ipAddress);
    if (!turnstile.success) {
      const code = Array.isArray(turnstile['error-codes']) && turnstile['error-codes'].length
        ? turnstile['error-codes'].join(',')
        : 'unknown';
      return respond(res, 401, { error: `Verification failed (${code}).` });
    }
  } catch (error) {
    console.error('[contact] turnstile verification failed', error);
    return respond(res, 502, { error: 'Verification service unavailable. Please retry later.' });
  }

  if (!resendClient || !resendFrom || resendTo.length === 0) {
    console.error('[contact] email delivery is not configured');
    return respond(res, 500, { error: 'Contact service misconfigured. Please try again later.' });
  }

  const safeName = sanitizeLine(data.name);
  const safeSubject = sanitizeLine(data.subject);
  const safeMessage = sanitizeMessage(data.message);

  const htmlBody = `
    <h2 style="margin:0 0 12px 0;">New contact form submission</h2>
    <p style="margin:0 0 8px 0;"><strong>From:</strong> ${escapeHtml(safeName)}</p>
    <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p style="margin:0 0 8px 0;"><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
    <p style="margin:16px 0 4px 0;"><strong>Message:</strong></p>
    <pre style="margin:0;font-family:'Fira Code', monospace;background:#f7f7f7;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(safeMessage)}</pre>
    <hr style="margin:20px 0;border:none;border-top:1px solid #e5e5e5;" />
    <p style="margin:4px 0;font-size:12px;color:#555;">IP: ${escapeHtml(ipAddress || 'unknown')}</p>
    <p style="margin:4px 0;font-size:12px;color:#555;">User-Agent: ${escapeHtml(req.headers['user-agent'] || 'unknown')}</p>
  `;

  const textBody = [
    'New contact form submission',
    `From: ${safeName}`,
    `Email: ${data.email}`,
    `Subject: ${safeSubject}`,
    '',
    safeMessage,
    '',
    `IP: ${ipAddress || 'unknown'}`,
    `User-Agent: ${req.headers['user-agent'] || 'unknown'}`
  ].join('\n');

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to: resendTo,
      subject: `[Portfolio] ${safeSubject}`,
      replyTo: data.email,
      html: htmlBody,
      text: textBody
    });
  } catch (error) {
    console.error('[contact] email delivery failed', error);
    return respond(res, 502, { error: 'Failed to deliver message. Please try again later.' });
  }

  return respond(res, 200, { success: true });
}
