import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage } from '../api/client.js';

export default function LoginPage() {
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
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'بيانات الدخول غير صحيحة'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="نبتة" className="brand-logo" />
          <h1>نبتة</h1>
          <p>منصة نبتة للتقنية الزراعية</p>
        </div>

        <form id="login-view" className="login-view" onSubmit={handleSubmit}>
          {error && <div id="login-error" className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="login-user">البريد الإلكتروني</label>
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
            <label htmlFor="login-pass">كلمة المرور</label>
            <div className="pass-wrap">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pass-eye icon-button"
                tabIndex={-1}
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
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
            {submitting ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
