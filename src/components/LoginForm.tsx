import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth, takeLoginMessage } from '../hooks/useAuth';
import { SEO } from './SEO';
import { stripUsername } from '../lib/userAccess';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [blockedHint, setBlockedHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  useEffect(() => {
    const message = takeLoginMessage();
    if (message) setError(message);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'உள்நுழைவில் பிழை ஏற்பட்டது');
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="KBS Tractors - Login"
        description="KBS Tractors - Professional tractor rental and sales management system. Secure login for business administration and equipment management."
        keywords="KBS Tractors login, KBS management login, tractor rental system access, business administration login, KBS equipment management"
        canonical="https://kbstractors.vercel.app/"
      />
      <div data-testid="login-container" className="kbs-app kbs-grain relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-pos/[0.14] blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[380px] w-[380px] rounded-full bg-brand/[0.18] blur-[120px]" />

        <div data-testid="login-card" className="relative z-10 w-full max-w-[400px] animate-rise-in">
          <div className="flex flex-col items-center text-center">
            <img
              data-testid="login-logo"
              src="/icons/kbs-tractors-192.png"
              alt="KBS Tractors"
              className="h-20 w-20 rounded-full ring-1 ring-line/15 shadow-[0_20px_50px_-12px_rgb(var(--brand)/0.6)]"
            />
            <h1 data-testid="login-title" className="mt-6 text-[26px] font-semibold tracking-tight">KBS Tractors</h1>
            <p data-testid="login-subtitle" className="mt-1 text-[14px] text-fog/50">உங்கள் கணக்கில் உள்நுழையவும்</p>
          </div>

          <form data-testid="login-form" onSubmit={handleSubmit} className="kbs-surface mt-8 space-y-4 rounded-[28px] p-5">
            <div>
              <label htmlFor="username" className="kbs-label">பயனர் பெயர்</label>
              <div className="kbs-field flex items-center gap-2.5">
                <User className="h-[18px] w-[18px] shrink-0 text-fog/35" />
                <input
                  data-testid="username-input"
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    // Letters only, case-insensitive: spaces, numbers and symbols never make it in.
                    const raw = e.target.value;
                    const clean = stripUsername(raw);
                    setUsername(clean);
                    if (clean.length !== raw.length) {
                      setBlockedHint(true);
                      clearTimeout(hintTimer.current);
                      hintTimer.current = setTimeout(() => setBlockedHint(false), 2200);
                    }
                  }}
                  maxLength={32}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full bg-transparent outline-none placeholder:text-fog/30"
                  placeholder="username"
                  required
                />
              </div>
              <p
                className={`mt-1.5 overflow-hidden text-[12px] transition-all duration-200 ${
                  blockedHint ? 'max-h-6 text-coral-300 opacity-100' : 'max-h-0 opacity-0'
                }`}
                aria-live="polite"
              >
                எழுத்துகள் மட்டும் (a–z) — இடைவெளி, எண்கள், குறியீடுகள் அனுமதி இல்லை
              </p>
            </div>
            <div>
              <label htmlFor="password" className="kbs-label">கடவுச்சொல்</label>
              <div className="kbs-field flex items-center gap-2.5">
                <Lock className="h-[18px] w-[18px] shrink-0 text-fog/35" />
                <input
                  data-testid="password-input"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-transparent outline-none placeholder:text-fog/30"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-fog/40 hover:text-fog/70"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <p data-testid="login-error" className="rounded-2xl bg-coral-500/10 px-4 py-3 text-[13.5px] font-medium text-coral-300 ring-1 ring-inset ring-coral-500/25">
                {error}
              </p>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={isLoading}
              className="kbs-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-semibold text-brand-fg shadow-[0_14px_36px_-10px_rgb(var(--brand)/0.6)] hover:bg-brand-hover disabled:opacity-60"
            >
              {isLoading ? (
                <span data-testid="login-loading-icon" className="h-5 w-5 animate-spin rounded-full border-2 border-brand-fg/30 border-t-brand-fg" />
              ) : (
                <>
                  உள்நுழைய
                  <ArrowRight className="h-[18px] w-[18px]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
