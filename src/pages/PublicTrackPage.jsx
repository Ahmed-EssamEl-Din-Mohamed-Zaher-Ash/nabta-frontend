import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from '../utils/leafletSetup.js';
import api from '../api/client.js';

const POLL_MS = 10_000;

// Public customer-facing tracking page (no login). The unguessable topic UUID
// in the URL is the only credential — mirrors the legacy #track flow.
export default function PublicTrackPage() {
  const { topic } = useParams();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timer = null;
    let disposed = false;

    const map = L.map(mapElRef.current).setView([25.2048, 55.2708], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    async function poll() {
      try {
        const { data } = await api.get(`/api/tracking/public/${topic}`);
        if (disposed) return;
        setInfo(data);
        setError(null);
        if (data.latest?.lat) {
          const pos = [data.latest.lat, data.latest.lng];
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${data.latest.state === 'live' ? '#16a34a' : '#f59e0b'};color:#fff;border-radius:8px;width:38px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.28)"><i class="fa-solid fa-truck" aria-hidden="true"></i></div>`,
            iconSize: [38, 30],
            iconAnchor: [19, 15],
          });
          if (markerRef.current) {
            markerRef.current.setLatLng(pos);
            markerRef.current.setIcon(icon);
          } else {
            markerRef.current = L.marker(pos, { icon }).addTo(map);
            map.setView(pos, 14);
          }
        }
      } catch (err) {
        if (!disposed) setError(err.response?.data?.error || 'تعذر تحميل بيانات التتبع.');
      }
      timer = setTimeout(poll, POLL_MS);
    }
    poll();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [topic]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img src="/logo.png" alt="نبتة" style={{ height: 40 }} />
        <h2 style={{ fontWeight: 800 }}>تتبع طلبك</h2>
        {info?.orderNumber && <p className="text-muted">الطلب: {info.orderNumber}</p>}
      </div>

      {error ? (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
          {error}
        </div>
      ) : info && !info.latest ? (
        <div style={{ background: 'var(--yellow-light)', color: 'var(--orange)', padding: 16, borderRadius: 8, textAlign: 'center', fontWeight: 600 }}>
          موقع المركبة غير متاح بعد. ستظهر المركبة هنا بمجرد بدء السائق التتبع.
        </div>
      ) : info?.latest ? (
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
          آخر تحديث: {new Date(info.latest.recordedAt).toLocaleTimeString('ar-AE')}
          {info.latest.state === 'stale' ? ' (الإشارة متقطعة)' : ''}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-body" style={{ padding: 0 }}>
          <div ref={mapElRef} style={{ height: 440, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    </div>
  );
}
