import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage } from '../api/client.js';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!initializing && isAuthenticated) {
    return <Navigate to={location.state?.from || '/dashboard'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError(t('auth.missingCredentials'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, t('auth.invalidCredentials')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt={t('auth.brandName')} className="brand-logo" />
          <h1>{t('auth.brandName')}</h1>
          <p>{t('auth.brandTagline')}</p>
        </div>

        <form id="login-view" className="login-view" onSubmit={handleSubmit}>
          {error && <div id="login-error" className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="login-user">{t('common.email')}</label>
            <input
              id="login-user"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-pass">{t('auth.password')}</label>
            <div className="pass-wrap">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pass-eye icon-button"
                tabIndex={-1}
                title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                onClick={() => setShowPassword((v) => !v)}
              >
                👁
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={submitting}
          >
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
