'use client';

import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { fetchWaybackForYear } from '@/lib/wayback';

import { TileLayer as LeafletTileLayer } from 'leaflet';

interface WaybackLayerProps {
  year: number;
  onInfoLoaded?: (info: { releaseDate: string | null; releaseId: number | null }) => void;
  onError?: () => void;
  onLayerReady?: (layer: LeafletTileLayer) => void;
  className?: string;
}

export default function WaybackLayer({ year, onInfoLoaded, onError, onLayerReady, className }: WaybackLayerProps) {
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string>('Esri Wayback Imagery');

  useEffect(() => {
    let active = true;
    let timeoutId: NodeJS.Timeout | null = null;

    async function load() {
      try {
        // Add timeout to prevent hanging
        const loadPromise = fetchWaybackForYear(year);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Wayback load timeout')), 10000); // 10 second timeout
        });

        const data = await Promise.race([loadPromise, timeoutPromise]);
        
        if (active && timeoutId) {
          clearTimeout(timeoutId);
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
        // Use fallback URL on error
        if (active) {
          const fallbackUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
          setTileUrl(fallbackUrl);
          setAttribution('Esri World Imagery (Fallback)');
          if (onError) {
            onError();
          }
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [year, onInfoLoaded, onError]);

  if (!tileUrl) return null;

  return (
    <TileLayer
      ref={(node) => {
          if (node && onLayerReady) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - react-leaflet types are tricky
              onLayerReady(node);
          }
      }}
      url={tileUrl}
      className={className}
      attribution={attribution}
      maxZoom={19}
      maxNativeZoom={17}
      eventHandlers={{
        tileerror: () => {
          if (onError) onError();
        }
      }}
    />
  );
}

