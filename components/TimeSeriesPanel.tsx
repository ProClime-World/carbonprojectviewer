'use client';

import React from 'react';
import { Polygon as PolygonType } from '@/lib/kmlParser';
// Wayback helper (manual/pinned per year with user override)

// Lazy load MapView tiles for small cards via react-leaflet TileLayer directly
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface TimeSeriesPanelProps {
  years: number[];
  selectedYear: number;
  polygon: PolygonType | null;
}

export default function TimeSeriesPanel({ years, selectedYear, polygon }: TimeSeriesPanelProps) {
  const rings = polygon?.coordinates?.[0] || [];

  if (!polygon || rings.length === 0) {
    return (
      <div className="w-96 h-full border-l bg-white p-4">
        <div className="text-gray-600">Select a polygon to see time series</div>
      </div>
    );
  }

  const coords = rings.map(c => [c.lat, c.lng] as [number, number]);

  return (
    <div className="w-96 h-full border-l bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="text-lg font-semibold text-gray-800">Time Series</div>
        <div className="text-xs text-gray-500">Selected polygon across years</div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {years.map((year) => (
          <CardForYear key={year} year={year} coords={coords} highlight={year === selectedYear} />
        ))}
      </div>
    </div>
  );
}

function FitToPolygon({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [10, 10] });
    }
  }, [coords, map]);
  return null;
}

function CardForYear({ year, coords, highlight }: { year: number; coords: [number, number][]; highlight: boolean }) {
  const [tileTemplate, setTileTemplate] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<string>('Esri Wayback');

  // Manual/pinned per-year release IDs with localStorage override
  function getPinned(): Record<number, number> {
    try {
      const raw = localStorage.getItem('wayback.releaseIds');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function setPinned(map: Record<number, number>) {
    try { localStorage.setItem('wayback.releaseIds', JSON.stringify(map)); } catch {}
  }
  function defaultRelease(y: number): number {
    const defaults: Record<number, number> = { 2017: 157, 2021: 268, 2025: 340 };
    return defaults[y] || 268;
  }

  React.useEffect(() => {
    const pinned = getPinned();
    const releaseId = pinned[year] || defaultRelease(year);
    const url = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseId=${releaseId}&cb=${releaseId}`;
    setTileTemplate(url);
    setMeta(`Esri Wayback Imagery • Release ${releaseId}`);
  }, [year]);

  return (
    <div className="bg-white border rounded-md shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium text-gray-700 border-b flex items-center justify-between gap-2">
        <span>{year}</span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{meta}</span>
          <ReleaseEditor year={year} onChange={(rid) => {
            const pinned = getPinned();
            pinned[year] = rid;
            setPinned(pinned);
            const url = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseId=${rid}&cb=${rid}`;
            setTileTemplate(url);
            setMeta(`Esri Wayback Imagery • Release ${rid}`);
          }} />
        </div>
      </div>
      <div className="h-48">
        <MapContainer center={coords[0]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
          {/* Basemap underneath as a safety net */}
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          {/* Year-specific Sentinel-2 visual overlay */}
          {tileTemplate && (
            <TileLayer
              key={`${year}-${tileTemplate}`}
              url={tileTemplate}
              attribution="Sentinel-2 via Titiler"
              opacity={0.98}
              crossOrigin={true}
            />
          )}
          <Polygon positions={coords} pathOptions={{ color: highlight ? '#f59e0b' : '#2d1b4e', weight: 2, fillOpacity: 0.2 }} />
          {/* Fit bounds per card */}
          <FitToPolygon coords={coords} />
        </MapContainer>
      </div>
    </div>
  );
}

function ReleaseEditor({ year, onChange }: { year: number; onChange: (rid: number) => void }) {
  const [value, setValue] = React.useState('');
  return (
    <div className="flex items-center gap-1">
      <label className="text-gray-400">Rel:</label>
      <input
        className="w-16 border rounded px-1 py-0.5 text-gray-600"
        placeholder="id"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const rid = Number(value);
            if (!Number.isNaN(rid) && rid > 0) onChange(rid);
          }
        }}
        title="Enter a Wayback releaseId and press Enter"
      />
    </div>
  );
}


