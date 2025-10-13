'use client';

import React from 'react';
import { Polygon as PolygonType } from '@/lib/kmlParser';
import { getWaybackTileUrlForYear, getWaybackAttribution, fetchWaybackForYear } from '@/lib/wayback';

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
  const [tileUrl, setTileUrl] = React.useState<string>(getWaybackTileUrlForYear(year));
  const [attr, setAttr] = React.useState<string>(getWaybackAttribution(year));
  const [releaseInfo, setReleaseInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    fetchWaybackForYear(year).then((data) => {
      if (!mounted) return;
      setTileUrl(data.url);
      setAttr(data.attribution);
      if (data.releaseId && data.releaseDate) {
        const yearStr = new Date(data.releaseDate).toISOString().slice(0, 10);
        setReleaseInfo(`#${data.releaseId} • ${yearStr}`);
      } else {
        setReleaseInfo(null);
      }
    });
    return () => { mounted = false; };
  }, [year]);

  return (
    <div className="bg-white border rounded-md shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium text-gray-700 border-b flex items-center justify-between">
        <span>{year}</span>
        <span className="text-xs text-gray-500">Source: {attr}{releaseInfo ? ` (${releaseInfo})` : ''}</span>
      </div>
      <div className="h-48">
        <MapContainer center={coords[0]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer key={`${year}-${tileUrl}`} url={tileUrl} attribution={attr} />
          <Polygon positions={coords} pathOptions={{ color: highlight ? '#f59e0b' : '#2d1b4e', weight: 2, fillOpacity: 0.2 }} />
          {/* Fit bounds per card */}
          <FitToPolygon coords={coords} />
        </MapContainer>
      </div>
    </div>
  );
}


