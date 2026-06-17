import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from '../utils/leafletSetup.js';
import api from '../api/client.js';
import { formatCurrency, orderTotals } from '../utils/format.js';

const STATUS_COLORS = {
  new: '#6366f1', confirmed: '#8b5cf6', preparing: '#f59e0b',
  ready: '#0ea5e9', out: '#3b82f6', delivered: '#22c55e',
  failed: '#ef4444', cancelled: '#6b7280',
};

const LEGEND = [
  { color: '#6366f1', status: 'new' },
  { color: '#f59e0b', status: 'preparing' },
  { color: '#3b82f6', status: 'out' },
  { color: '#22c55e', status: 'delivered' },
  { color: '#ef4444', status: 'failed' },
];

const LIVE_POLL_MS = 10_000;

export default function TrackingMapPage() {
  const { t } = useTranslation();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const liveMarkersRef = useRef({}); // sessionId -> L.marker
  const [orderCount, setOrderCount] = useState(0);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let pollTimer = null;
    let disposed = false;

    const map = L.map(mapElRef.current).setView([25.2048, 55.2708], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // 1. Static order markers (orders that have a delivery location)
    async function loadOrders() {
      const tt = tRef.current;
      const { data } = await api.get('/api/orders', { params: { limit: 100 } });
      if (disposed) return;
      const located = data.orders.filter((o) => o.location?.lat);
      setOrderCount(located.length);

      located.forEach((o) => {
        const color = STATUS_COLORS[o.status] || '#6b7280';
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-family:Tajawal,sans-serif">${o.orderNumber.replace('ORD-', '').slice(-4)}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([o.location.lat, o.location.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Tajawal,sans-serif;min-width:200px;direction:rtl">
              <strong style="font-size:14px">${o.orderNumber}</strong><br>
              <span style="color:${color};font-weight:700">${tt(`status.${o.status}`, o.status)}</span><br>
              <span style="font-size:12px">${tt('common.customer')}: ${o.customer?.name || '-'}</span><br>
              ${o.driver ? `<span style="font-size:12px">${tt('common.driver')}: ${o.driver.name}</span><br>` : ''}
              <span style="font-size:12px">${tt('common.date')}: ${o.date}</span><br>
              <span style="font-size:12px">${tt('common.total')}: ${formatCurrency(orderTotals(o).total)}</span>
            </div>`
          );
      });

      if (located.length > 0) {
        const group = L.featureGroup(located.map((o) => L.marker([o.location.lat, o.location.lng])));
        map.fitBounds(group.getBounds().pad(0.2));
      }
    }

    // 2. Live vehicle markers — polled REST instead of the old Supabase realtime
    async function pollLive() {
      try {
        const tt = tRef.current;
        const { data } = await api.get('/api/tracking/active');
        if (disposed) return;
        data.locations.forEach((loc) => {
          const liveColor = loc.state === 'live' ? '#16a34a' : '#f59e0b';
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${liveColor};color:#fff;border-radius:8px;width:38px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.28)"><i class="fa-solid fa-truck" aria-hidden="true"></i></div>`,
            iconSize: [38, 30],
            iconAnchor: [19, 15],
          });
          const popup = `<div style="font-family:Tajawal,sans-serif;min-width:180px;direction:rtl">
            <strong>${tt('tracking.liveVehicle')}</strong><br>
            <span style="font-size:12px">${tt('tracking.order')}: ${loc.orderNumber || '-'}</span><br>
            <span style="font-size:12px">${tt('common.driver')}: ${loc.driverName || '-'}</span><br>
            <span style="font-size:12px">${tt('tracking.lastSignal')}: ${loc.recordedAt ? new Date(loc.recordedAt).toLocaleTimeString('ar-AE') : '-'}</span>
          </div>`;

          const existing = liveMarkersRef.current[loc.sessionId];
          if (existing) {
            existing.setLatLng([loc.lat, loc.lng]);
            existing.setIcon(icon);
            existing.bindPopup(popup);
          } else {
            liveMarkersRef.current[loc.sessionId] = L.marker([loc.lat, loc.lng], { icon })
              .addTo(map)
              .bindPopup(popup);
          }
        });
      } catch {
        // polling errors are transient; next tick retries
      }
      pollTimer = setTimeout(pollLive, LIVE_POLL_MS);
    }

    loadOrders();
    pollLive();

    return () => {
      disposed = true;
      if (pollTimer) clearTimeout(pollTimer);
      map.remove();
      mapRef.current = null;
      liveMarkersRef.current = {};
    };
  }, []);

  return (
    <>
      <div className="page-header">
        <h2><i className="fa-solid fa-map-location-dot" aria-hidden="true" /> {t('tracking.title')}</h2>
        <span className="text-muted">{t('tracking.countOnMap', { count: orderCount })}</span>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {LEGEND.map((l) => (
              <span key={l.status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                {t(`status.${l.status}`)}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ width: 14, height: 12, borderRadius: 3, background: '#16a34a', display: 'inline-block' }} />
              {t('tracking.liveVehicle')}
            </span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div ref={mapElRef} style={{ height: 520, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    </>
  );
}
