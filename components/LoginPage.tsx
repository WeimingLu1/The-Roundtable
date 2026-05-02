import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowRight, Loader2, Github } from 'lucide-react';

export function LoginPage() {
  const { login, loginWithGoogle, loginWithGithub, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      if (!user.identity) navigate('/onboarding');
      else navigate('/');
    }
  }, [user]);

  // Handle GitHub OAuth callback
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, '', '/');
      setBusy(true);
      loginWithGithub(code)
        .catch(e => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  const handleGithubLogin = () => {
    const clientId = (import.meta as any).env?.VITE_GITHUB_CLIENT_ID || 'your-github-client-id';
    const redirectUri = window.location.origin + '/login';
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-md-surface-container rounded-3xl shadow-elevation-2 p-8 border border-white/10">
        <div className="mb-8 text-center">
          <h1 className="font-sans text-3xl font-bold text-md-primary tracking-tight">The Roundtable</h1>
          <p className="text-md-secondary text-sm mt-2">Sign in to join the discussion.</p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              size="large"
              text="signin_with"
              shape="pill"
            />
          </div>

          <button
            onClick={handleGithubLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full bg-[#24292e] text-white hover:bg-[#2f363d] transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Github size={18} />
            Sign in with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1 border-white/10" />
          <span className="text-xs text-md-outline uppercase">or</span>
          <hr className="flex-1 border-white/10" />
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || !password || busy}
            className="w-full bg-md-accent text-black font-medium py-4 rounded-full shadow-elevation-1 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-md-secondary mt-6">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-md-accent font-medium hover:underline">
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
