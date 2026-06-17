import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from '../utils/leafletSetup.js';
import Modal from './Modal.jsx';
import { useToast } from './ToastHost.jsx';

const DUBAI_CENTER = [25.2048, 55.2708];

/**
 * Leaflet location picker — React port of legacy openMapPicker().
 * Click or drag to place the marker, search via Nominatim, or use GPS.
 * onPick receives { lat, lng, address }.
 */
export default function MapPickerModal({ initial, onPick, onClose }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  function place(lat, lng, address) {
    const addr = address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        place(pos.lat, pos.lng);
      });
    }
    mapRef.current.setView([lat, lng], 14);
    setSelected({ lat, lng, address: addr });
  }

  useEffect(() => {
    // Wait one tick so the modal layout settles before Leaflet measures it
    const t = setTimeout(() => {
      const map = L.map(mapElRef.current).setView(
        initial?.lat ? [initial.lat, initial.lng] : DUBAI_CENTER,
        initial?.lat ? 14 : 11
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      map.on('click', (e) => place(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      if (initial?.lat) place(initial.lat, initial.lng, initial.address);
    }, 100);

    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' UAE')}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'ar' } }
      );
      const data = await res.json();
      if (data?.length) {
        place(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name);
      } else {
        showToast(t('map.notFound'), 'error');
      }
    } catch {
      showToast(t('map.searchError'), 'error');
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      showToast(t('map.geolocationUnsupported'), 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => place(pos.coords.latitude, pos.coords.longitude),
      () => showToast(t('map.locationDenied'), 'error')
    );
  }

  return (
    <Modal
      title={t('map.title')}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => {
              onPick(selected);
              showToast(t('common.locationSet'), 'success');
            }}
          >
            {t('map.confirmLocation')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          placeholder={t('map.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" onClick={search} disabled={searching}>
          {searching ? '...' : t('common.search')}
        </button>
        <button className="btn btn-secondary" onClick={useMyLocation} title={t('map.useMyLocationTitle')}>
          <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> {t('map.myLocation')}
        </button>
      </div>
      <div ref={mapElRef} style={{ height: 380, borderRadius: 8 }} />
      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--gray-600)' }}>
        {selected ? (
          <>
            <strong><i className="fa-solid fa-location-dot" aria-hidden="true" /> {t('map.coordinates')}:</strong>{' '}
            {t('map.latLng', { lat: selected.lat.toFixed(6), lng: selected.lng.toFixed(6) })}
          </>
        ) : (
          t('map.clickToSelect')
        )}
      </div>
    </Modal>
  );
}
