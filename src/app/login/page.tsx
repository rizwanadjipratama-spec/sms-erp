'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/lib/services';
import { supabase } from '@/lib/db';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loadingState, setLoadingState] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const router = useRouter();
  const { profile, loading } = useAuth();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (loading || !profile) return;
    router.replace(authService.getRoleRedirect(profile.role));
  }, [profile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingState(true);
    setError('');

    try {
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        // onAuthStateChange in useAuth will handle loadProfile → redirect
      }

      if (mode === 'register') {
        const { error: registerError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (registerError) throw registerError;
        setMode('login');
        setSent(true);
        return;
      }

      if (mode === 'forgot') {
        const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (forgotError) throw forgotError;
        setSent(true);
        return;
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong';

      setError(
        errorMessage.toLowerCase().includes('invalid')
          ? 'Email or password is incorrect'
          : errorMessage
      );

      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    } finally {
      setLoadingState(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingState(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError('Google login failed. Try again.');
    } finally {
      setLoadingState(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-xl shadow-xl p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'forgot' ? 'Check your email' : 'Account created'}
          </h2>

          <p className="text-gray-600 mb-6">
            {mode === 'forgot' ? (
              <>
                Reset link sent to <strong>{email}</strong>
              </>
            ) : (
              'Check your email to confirm account'
            )}
          </p>

          <p className="text-sm text-gray-500 mb-8">
            Click the link to continue. Check spam folder.
          </p>

          <button
            onClick={() => {
              setSent(false);
              setEmail('');
              setPassword('');
            }}
            className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-lg hover:bg-gray-200 transition"
          >
            Back to login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-12 relative">
      <Link href="/" className="absolute top-8 left-8 text-sm font-medium text-gray-500 hover:text-gray-900 transition flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Home
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-md w-full bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-10 ${shake ? 'animate-pulse' : ''}`}
      >
        <div className="text-center mb-8">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">
            SMS LAB SYSTEM
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mb-3">
            {mode === 'login'
              ? 'Sign In'
              : mode === 'register'
                ? 'Create Account'
                : 'Forgot Password'}
          </h1>

          <p className="text-gray-500 text-sm">
            Secure access to SMS Laboratory System
          </p>

          <p className="text-gray-600">
            {mode === 'login'
              ? 'Enter your credentials'
              : mode === 'register'
                ? 'Join SMS Lab'
                : 'Enter email to reset'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm"
            >
              {error}
            </motion.div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loadingState}
            className="w-full border border-gray-200 py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition text-sm disabled:opacity-50"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5"
            />
            Continue with Google
          </button>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/80"
          />

          {mode !== 'forgot' && (
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required={mode === 'login'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/80"
            />
          )}

          <button
            type="submit"
            disabled={
              loadingState ||
              !email ||
              (mode !== 'forgot' && !password) ||
              (mode !== 'forgot' && password.length < 6)
            }
            className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {loadingState
              ? 'Loading...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="flex justify-between mt-6 text-sm">
          {mode === 'login' ? (
            <>
              <button onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
              <button onClick={() => setMode('register')}>
                Create account
              </button>
            </>
          ) : (
            <button onClick={() => setMode('login')}>
              Back to login
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
