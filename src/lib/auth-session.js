import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fd_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function buildSessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function getSigningSecret() {
  return process.env.AUTH_SESSION_SECRET || '';
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(userId) {
  const secret = getSigningSecret();
  if (!secret) throw new Error('AUTH_SESSION_SECRET não configurado.');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidSessionToken(token) {
  const secret = getSigningSecret();
  if (!secret || typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof session.sub === 'string' && session.sub.length > 0 && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
