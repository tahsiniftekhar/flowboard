'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';

interface AuthFormProps {
  onAuth: (token: string, user: User) => void;
  message?: string;
}

export function AuthForm({ onAuth, message }: AuthFormProps) {
  const [register, setRegister] = useState(false);
  const [visiblePassword, setVisiblePassword] = useState({ login: false, register: false });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(message ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const form = register ? registerForm : loginForm;
    const problem = !form.email
      ? 'Enter your email.'
      : !form.password
        ? 'Enter your password.'
        : register && !registerForm.name
          ? 'Enter your name.'
          : register && form.password.length < 8
            ? 'Password must be at least 8 characters.'
            : '';

    if (problem) return setError(problem);

    setBusy(true);
    setError('');

    try {
      const payload = form;
      const result = await api<{ accessToken: string; user: User }>(
        `/auth/${register ? 'register' : 'login'}`,
        null,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      onAuth(result.accessToken, result.user);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? 'Email or password is incorrect.'
            : err.message
          : 'Unable to continue. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-copy">
        <p className="eyebrow">FLOWBOARD / WORKSPACE</p>
        <h1>Make progress visible.</h1>
        <p>One calm place for the work your team is carrying.</p>
      </div>
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-tabs">
          <button
            type="button"
            className={!register ? 'active' : ''}
            onClick={() => {
              setRegister(false);
              setError('');
              setVisiblePassword((current) => ({ ...current, login: false }));
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={register ? 'active' : ''}
            onClick={() => {
              setRegister(true);
              setError('');
              setVisiblePassword((current) => ({ ...current, register: false }));
            }}
          >
            Register
          </button>
        </div>
        <h2>{register ? 'Start a workspace' : 'Welcome back'}</h2>
        {register && (
          <label>
            Name
            <input
              autoComplete="name"
              value={registerForm.name}
              onChange={(event) =>
                setRegisterForm({ ...registerForm, name: event.target.value })
              }
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={register ? registerForm.email : loginForm.email}
            onChange={(event) =>
              register
                ? setRegisterForm({ ...registerForm, email: event.target.value })
                : setLoginForm({ ...loginForm, email: event.target.value })
            }
          />
        </label>
        <label>
          Password
          <div className="password-field">
            <input
              key={register ? 'register-password' : 'login-password'}
              id={register ? 'register-password' : 'login-password'}
              name={register ? 'register-password' : 'login-password'}
              type={visiblePassword[register ? 'register' : 'login'] ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              value={register ? registerForm.password : loginForm.password}
              onChange={(event) =>
                register
                  ? setRegisterForm({ ...registerForm, password: event.target.value })
                  : setLoginForm({ ...loginForm, password: event.target.value })
              }
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setVisiblePassword((current) => ({
                  ...current,
                  [register ? 'register' : 'login']: !current[register ? 'register' : 'login'],
                }))
              }
            >
              {visiblePassword[register ? 'register' : 'login'] ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button busy={busy}>{register ? 'Create account' : 'Enter workspace'}</Button>
      </form>
    </main>
  );
}
