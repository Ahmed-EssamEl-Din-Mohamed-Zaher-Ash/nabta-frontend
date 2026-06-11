import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const activeRef = useRef(new Set());

  const showToast = useCallback((message, type = 'success') => {
    // Identical toast already on screen (e.g. StrictMode double-effect in
    // dev firing the same error twice) — show it once.
    const key = `${type}:${message}`;
    if (activeRef.current.has(key)) return;
    activeRef.current.add(key);
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => {
      activeRef.current.delete(key);
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
