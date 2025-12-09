'use client';

import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { fetchWaybackForYear } from '@/lib/wayback';

interface WaybackLayerProps {
  year: number;
  onInfoLoaded?: (info: { releaseDate: string | null; releaseId: number | null }) => void;
}

export default function WaybackLayer({ year, onInfoLoaded }: WaybackLayerProps) {
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string>('Esri Wayback Imagery');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchWaybackForYear(year);
        if (active) {
          setTileUrl(data.url);
          setAttribution(data.attribution);
          if (onInfoLoaded) {
            onInfoLoaded({
              releaseDate: data.releaseDate,
              releaseId: data.releaseId
            });
          }
        }
      } catch (err) {
        console.error('Failed to load Wayback layer:', err);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [year, onInfoLoaded]);

  if (!tileUrl) return null;

  return (
    <TileLayer
      url={tileUrl}
      attribution={attribution}
      maxZoom={19}
    />
  );
}

