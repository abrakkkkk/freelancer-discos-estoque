import { buildSessionCookie } from '@/lib/auth-session';

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', buildSessionCookie('', 0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
