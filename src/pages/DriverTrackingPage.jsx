import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const showToast = useToast();
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState({ type: 'info', msg: t('driverTracking.statusReady') });
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
      setStatus({ type: 'success', msg: t('driverTracking.lastPing', { time: new Date().toLocaleTimeString() }) });
      if (data.session?.publicTopic) {
        setPublicLink(`${window.location.origin}/track/${data.session.publicTopic}`);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: apiErrorMessage(err, t('driverTracking.pingFailed')) });
    }
  }

  function start() {
    if (!selectedId) {
      setStatus({ type: 'error', msg: t('driverTracking.selectTripFirst') });
      return;
    }
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: t('driverTracking.geolocationUnsupported') });
      return;
    }
    orderIdRef.current = selectedId;
    lastSentRef.current = 0; // send the first fix immediately
    setStatus({ type: 'info', msg: t('driverTracking.requestingPermission') });
    stopWatching();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendPing(pos),
      (err) => setStatus({ type: 'error', msg: err.message || t('driverTracking.gpsUnavailable') }),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setTracking(true);
  }

  async function stop() {
    stopWatching();
    setTracking(false);
    setStatus({ type: 'warning', msg: t('driverTracking.trackingStopped') });
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
        <h2><i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> {t('driverTracking.title')}</h2>
        <span className="text-muted">{t('driverTracking.subtitle', { seconds: PING_INTERVAL_MS / 1000 })}</span>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>{t('driverTracking.noActiveTrips')}</h3>
          <p className="text-muted">{t('driverTracking.noActiveTripsHint')}</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label htmlFor="driver-tracking-order">{t('driverTracking.activeTrip')}</label>
              <select
                id="driver-tracking-order"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={tracking}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} - {o.customer?.name || '-'} - {o.vehicle?.plate || t('driverTracking.noVehicle')}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={start} disabled={tracking}>
                <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> {t('driverTracking.startTracking')}
              </button>
              <button className="btn btn-secondary" onClick={stop} disabled={!tracking}>
                <i className="fa-solid fa-stop" aria-hidden="true" /> {t('driverTracking.stop')}
              </button>
            </div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, ...STATUS_STYLES[status.type] }}>
              {status.msg}
            </div>
            {publicLink && (
              <div className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>
                {t('driverTracking.customerLink')} <code dir="ltr">{publicLink}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
