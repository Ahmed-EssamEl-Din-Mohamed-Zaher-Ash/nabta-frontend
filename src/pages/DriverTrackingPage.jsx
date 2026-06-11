import { useEffect, useRef, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';

const PING_INTERVAL_MS = 15_000;

const STATUS_STYLES = {
  info: { background: 'var(--blue-light)', color: 'var(--blue)' },
  success: { background: 'var(--green-100)', color: 'var(--green-800)' },
  error: { background: 'var(--red-light)', color: 'var(--red)' },
  warning: { background: 'var(--yellow-light)', color: 'var(--orange)' },
};

export default function DriverTrackingPage() {
  const showToast = useToast();
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState({ type: 'info', msg: 'جاهز. أبقِ هذه الصفحة مفتوحة أثناء التوصيل.' });
  const [publicLink, setPublicLink] = useState(null);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const orderIdRef = useRef('');

  useEffect(() => {
    api
      .get('/api/orders', { params: { status: 'out', limit: 100 } })
      .then(({ data }) => {
        setOrders(data.orders);
        if (data.orders.length) setSelectedId(data.orders[0].id);
      })
      .catch((err) => showToast(apiErrorMessage(err), 'error'));

    return () => stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopWatching() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function sendPing(pos) {
    const now = Date.now();
    if (now - lastSentRef.current < PING_INTERVAL_MS) return; // throttle
    lastSentRef.current = now;
    try {
      const { coords } = pos;
      const { data } = await api.post('/api/tracking/ping', {
        orderId: orderIdRef.current,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
      });
      setStatus({ type: 'success', msg: `آخر إشارة GPS أُرسلت ${new Date().toLocaleTimeString('ar-AE')}` });
      if (data.session?.publicTopic) {
        setPublicLink(`${window.location.origin}/track/${data.session.publicTopic}`);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: apiErrorMessage(err, 'فشل إرسال الموقع.') });
    }
  }

  function start() {
    if (!selectedId) {
      setStatus({ type: 'error', msg: 'اختر رحلة نشطة أولاً.' });
      return;
    }
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: 'المتصفح لا يدعم تحديد الموقع.' });
      return;
    }
    orderIdRef.current = selectedId;
    lastSentRef.current = 0; // send the first fix immediately
    setStatus({ type: 'info', msg: 'جارٍ طلب إذن GPS...' });
    stopWatching();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendPing(pos),
      (err) => setStatus({ type: 'error', msg: err.message || 'تعذر الوصول إلى GPS.' }),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setTracking(true);
  }

  async function stop() {
    stopWatching();
    setTracking(false);
    setStatus({ type: 'warning', msg: 'تم إيقاف التتبع المباشر.' });
    if (orderIdRef.current) {
      try {
        await api.post('/api/tracking/end', { orderId: orderIdRef.current });
      } catch {
        // session simply stays active until it goes stale — not fatal
      }
    }
  }

  return (
    <>
      <div className="page-header">
        <h2><i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> تتبع السائق الحي</h2>
        <span className="text-muted">يُرسل الموقع كل {PING_INTERVAL_MS / 1000} ثانية أثناء فتح الصفحة</span>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>لا توجد رحلات نشطة</h3>
          <p className="text-muted">تظهر هنا الطلبات التي حالتها في الطريق والمخصصة لهذا السائق.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label htmlFor="driver-tracking-order">الرحلة النشطة</label>
              <select
                id="driver-tracking-order"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={tracking}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} - {o.customer?.name || '-'} - {o.vehicle?.plate || 'بدون مركبة'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={start} disabled={tracking}>
                <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> بدء التتبع المباشر
              </button>
              <button className="btn btn-secondary" onClick={stop} disabled={!tracking}>
                <i className="fa-solid fa-stop" aria-hidden="true" /> إيقاف
              </button>
            </div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, ...STATUS_STYLES[status.type] }}>
              {status.msg}
            </div>
            {publicLink && (
              <div className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>
                رابط التتبع الآمن للعميل: <code dir="ltr">{publicLink}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
