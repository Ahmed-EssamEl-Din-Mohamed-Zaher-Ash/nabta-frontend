import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV_ITEMS, ROLE_PAGES } from '../constants/permissions.js';
import NavIcon from './NavIcon.jsx';

export default function AppShell() {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const headerDate = new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-AE' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');

  // Pages this role may see, in legacy NAV_ITEMS order, grouped by section.
  const allowedPages = ROLE_PAGES[role] ?? [];
  const sections = [];
  let current = null;
  for (const [page, item] of Object.entries(NAV_ITEMS)) {
    if (!allowedPages.includes(page)) continue;
    if (!current || current.title !== item.section) {
      current = { title: item.section, pages: [] };
      sections.push(current);
    }
    current.pages.push({ page, ...item });
  }

  const activePage = location.pathname.replace(/^\//, '') || 'dashboard';
  const pageTitle = t(`nav.${activePage}`, { defaultValue: NAV_ITEMS[activePage]?.label || '' });

  return (
    <div id="app">
      <nav id="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt={t('brand.name')} className="brand-logo" />
          <div className="sidebar-logo-text">
            <h2>{t('brand.name')}</h2>
            <p>{t('brand.subtitle')}</p>
          </div>
        </div>

        <div id="sidebar-nav" className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="nav-section-title">{t(`sections.${section.title}`, section.title)}</div>
              {section.pages.map(({ page, label, icon }) => (
                <NavLink
                  key={page}
                  to={`/${page}`}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  id={`nav-${page}`}
                >
                  <NavIcon name={icon} />
                  <span>{t(`nav.${page}`, label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div id="user-avatar" className="sidebar-user-avatar">
              {(user?.name || t('user')).charAt(0)}
            </div>
            <div className="sidebar-user-info">
              <h4 id="user-name">{user?.name || t('user')}</h4>
              <p id="user-role-label">{t(`roles.${role}`, role)}</p>
            </div>
          </div>
          <button type="button" className="btn-logout" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </nav>

      <div id="main">
        <header id="header">
          <h2 id="page-title">{pageTitle}</h2>
          <div className="header-actions">
            <button type="button" className="header-badge" onClick={toggleLang} style={{ cursor: 'pointer', border: 'none' }} title="Language / اللغة">
              <i className="fa-solid fa-language" aria-hidden="true" /> {t('switchLang')}
            </button>
            <span id="header-role-badge" className="header-badge">
              {t(`roles.${role}`, role)}
            </span>
            <span id="header-date" className="text-muted header-date">
              {headerDate}
            </span>
          </div>
        </header>
        <main id="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
