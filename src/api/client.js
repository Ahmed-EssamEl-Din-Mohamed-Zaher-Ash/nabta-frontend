import axios from 'axios';
import i18n from '../i18n/index.js';

export const TOKEN_KEY = 'nabta_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Empty baseURL in dev → requests hit the Vite proxy (/api → localhost:4000).
// In production VITE_API_URL points at the deployed Express server.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isAuthCall = error.config?.url?.includes('/api/auth/login');
    // Expired/invalid session: clear it and send the user to login —
    // but never for the login request itself (wrong password ≠ expired session).
    if (status === 401 && !isAuthCall) {
      setToken(null);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extract a human-readable message from an API error. The server's own error
 * text (error.response.data.error) is shown as-is when present; the local
 * fallbacks are localized via i18n (resolved at call time).
 */
export function apiErrorMessage(error, fallback) {
  const fb = fallback ?? i18n.t('errors.unexpected');
  return error?.response?.data?.error || (error?.code === 'ECONNABORTED' ? i18n.t('errors.timeout') : fb);
}

export default api;
