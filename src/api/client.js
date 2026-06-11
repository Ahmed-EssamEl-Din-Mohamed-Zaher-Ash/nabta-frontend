import axios from 'axios';

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
  baseURL: import.meta.env.VITE_API_URL || '',
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

/** Extract a human-readable Arabic message from an API error. */
export function apiErrorMessage(error, fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.') {
  return error?.response?.data?.error || (error?.code === 'ECONNABORTED' ? 'انتهت مهلة الاتصال بالخادم.' : fallback);
}

export default api;
