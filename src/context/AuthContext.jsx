import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true until the stored token (if any) has been validated against /api/auth/me
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (!getToken()) {
        setInitializing(false);
        return;
      }
      try {
        const { data } = await api.get('/api/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        // 401 is already handled by the interceptor (token cleared);
        // network errors just leave the user logged out.
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      initializing,
      login,
      logout,
    }),
    [user, initializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
