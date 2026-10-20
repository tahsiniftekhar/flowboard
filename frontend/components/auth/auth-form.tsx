'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { api, ApiError } from '@/lib/api';
import { safeNextPath, useAuth } from '@/lib/auth';
import type { User } from '@/types';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

type Mode = 'login' | 'register';
type Field = 'name' | 'email' | 'password';

const DEMO_EMAIL = 'owner@example.com';
const DEMO_PASSWORD = 'FlowboardDemo123!';

function validate(mode: Mode, values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (mode === 'register' && !values.name.trim()) errors.name = 'Enter your name.';
  if (!values.email.trim()) errors.email = 'Enter your email.';
  else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (mode === 'register' && values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }
  return errors;
}

function BrandPanel() {
  return (
    <section className="auth-brand">
      <div className="brand">
        <Image src="/fb-icon.png" alt="" width={30} height={30} />
        <strong>Flowboard</strong>
      </div>

      <div className="auth-brand-copy">
        <p className="eyebrow">FLOWBOARD / BOARDS</p>
        <h1>Make progress visible.</h1>
        <p>One calm place for the work your team is carrying. Plan in columns, share with a click.</p>
        <ul className="auth-features">
          <li>Drag-and-drop boards</li>
          <li>Share with teammates</li>
          <li>Priorities and due dates</li>
        </ul>
      </div>

      <div className="auth-illustration" aria-hidden="true">
        <div className="mini-col">
          <b>To do</b>
          <div className="mini-card accent" />
          <div className="mini-card short" />
        </div>
        <div className="mini-col">
          <b>Doing</b>
          <div className="mini-card lift" />
        </div>
        <div className="mini-col">
          <b>Done</b>
          <div className="mini-card short" />
          <div className="mini-card" />
        </div>
      </div>
    </section>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const isRegister = mode === 'register';
  const { user, isReady, signIn, sessionExpired } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const nextSuffix = searchParams.get('next') ? `?next=${encodeURIComponent(next)}` : '';

  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in (or just signed in): leave the auth pages.
  useEffect(() => {
    if (isReady && user) router.replace(next);
  }, [isReady, user, next, router]);

  const errors = validate(mode, values);

  function setValue(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function fieldError(field: Field) {
    return touched[field] ? errors[field] : undefined;
  }

  function fillDemo() {
    setValues({ name: '', email: DEMO_EMAIL, password: DEMO_PASSWORD });
    setTouched({});
    setFormError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setFormError('');
    try {
      const payload = isRegister
        ? { name: values.name.trim(), email: values.email.trim(), password: values.password }
        : { email: values.email.trim(), password: values.password };
      const result = await api<{ accessToken: string; user: User }>(
        `/auth/${mode}`,
        null,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      signIn(result.accessToken, result.user);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.status === 401
            ? 'Email or password is incorrect.'
            : err.message
          : 'Unable to reach the server. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <BrandPanel />

      <div className="auth-main">
        <div className="auth-theme">
          <ThemeToggle compact />
        </div>

        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div>
            <h2>{isRegister ? 'Start your first board' : 'Welcome back'}</h2>
          </div>
          <p className="auth-sub">
            {isRegister ? 'Create an account to start your first board.' : 'Log in to pick up your boards.'}
          </p>

          {sessionExpired && !isRegister && (
            <p className="form-alert info" role="status">
              Your session has expired. Please sign in again.
            </p>
          )}

          {isRegister && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                autoComplete="name"
                value={values.name}
                aria-invalid={Boolean(fieldError('name'))}
                aria-describedby={fieldError('name') ? 'name-error' : undefined}
                onChange={(event) => setValue('name', event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
              {fieldError('name') && (
                <p className="field-error" id="name-error">
                  {fieldError('name')}
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              aria-invalid={Boolean(fieldError('email'))}
              aria-describedby={fieldError('email') ? 'email-error' : undefined}
              onChange={(event) => setValue('email', event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {fieldError('email') && (
              <p className="field-error" id="email-error">
                {fieldError('email')}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={values.password}
                aria-invalid={Boolean(fieldError('password'))}
                aria-describedby={fieldError('password') ? 'password-error' : undefined}
                onChange={(event) => setValue('password', event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
              <button
                type="button"
                className="password-toggle"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldError('password') && (
              <p className="field-error" id="password-error">
                {fieldError('password')}
              </p>
            )}
          </div>

          {formError && (
            <p className="form-alert" role="alert">
              {formError}
            </p>
          )}

          <Button busy={busy} className="auth-submit">
            {isRegister ? 'Create account' : 'Log in'}
          </Button>

          <p className="auth-switch">
            {isRegister ? (
              <>
                Already have an account? <Link href={`/login${nextSuffix}`}>Log in</Link>
              </>
            ) : (
              <>
                New to Flowboard? <Link href={`/register${nextSuffix}`}>Create an account</Link>
              </>
            )}
          </p>

          {!isRegister && (
            <div className="demo-box">
              <span>
                Try the demo account
                <br />
                <code>{DEMO_EMAIL}</code> / <code>{DEMO_PASSWORD}</code>
              </span>
              <button type="button" className="secondary-button" onClick={fillDemo}>
                Fill in
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
