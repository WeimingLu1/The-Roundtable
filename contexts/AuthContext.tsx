import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { navigate } from '../lib/router';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url?: string;
  identity: string;
  language: string;
  auth_provider: string;
  is_admin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, language: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithGithub: (code: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; identity?: string; language?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'roundtable_token';

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return getStoredToken();
}

async function api(path: string, body?: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      api('/api/auth/me', undefined, stored)
        .then(data => {
          setUser(data);
          setToken(stored);
        })
        .catch(() => {
          clearToken();
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api('/api/auth/login', { email, password });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, language: string) => {
    const data = await api('/api/auth/register', { email, password, name, language });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await api('/api/auth/google', { credential });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const loginWithGithub = useCallback(async (code: string) => {
    const data = await api('/api/auth/github', { code });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    navigate('/login');
  }, []);

  const updateProfile = useCallback(async (profileData: { name?: string; identity?: string; language?: string }) => {
    if (!token) throw new Error('Not authenticated');
    const data = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    }).then(r => {
      if (!r.ok) throw new Error('Failed to update profile');
      return r.json();
    });
    setUser(data);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogle, loginWithGithub, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
