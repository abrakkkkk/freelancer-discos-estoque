'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

function safeReturnPath() {
  const requestedPath = new URLSearchParams(window.location.search).get('next');
  return requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
}

async function establishProxySession(accessToken) {
  return fetch('/api/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!active || !session) return;

        if (session.expires_at && session.expires_at * 1000 - Date.now() < 60 * 1000) {
          const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: {} }));
          if (refreshed?.session) session = refreshed.session;
        }

        let response = await establishProxySession(session.access_token).catch(() => null);
        if (response?.status === 401) {
          const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: {} }));
          if (refreshed?.session) {
            response = await establishProxySession(refreshed.session.access_token).catch(() => null);
          }
        }

        if (response?.ok && active) {
          window.location.replace(safeReturnPath());
        }
      } catch {
        if (active) setError('Não foi possível validar sua sessão. Verifique a conexão e tente novamente.');
      }
    };

    void restoreSession();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.session) {
        throw new Error('E-mail ou senha incorretos.');
      }

      const response = await establishProxySession(data.session.access_token);
      if (!response.ok) {
        await supabase.auth.signOut();
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Não foi possível iniciar uma sessão segura.');
      }

      window.location.assign(safeReturnPath());
    } catch (loginError) {
      setError(loginError.message || 'Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <Image
          className="login-logo"
          src="/logo-login.png"
          alt="Freelancer Discos"
          width={912}
          height={548}
          priority
        />
        <h1 id="login-title">Controle de Estoque</h1>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">E-mail</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nome@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="login-password-toggle"
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.2 4.1M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1 0 2-.2 2.9-.5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn btn-primary login-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
