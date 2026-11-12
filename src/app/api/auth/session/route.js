import { createClient } from '@supabase/supabase-js';
import { buildSessionCookie, createSessionToken, SESSION_MAX_AGE } from '@/lib/auth-session';

export async function POST(request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!accessToken) {
    return Response.json({ error: 'Sessão Supabase ausente.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !process.env.AUTH_SESSION_SECRET) {
    return Response.json({ error: 'Autenticação não configurada no servidor.' }, { status: 503 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return Response.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', buildSessionCookie(createSessionToken(data.user.id), SESSION_MAX_AGE));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
