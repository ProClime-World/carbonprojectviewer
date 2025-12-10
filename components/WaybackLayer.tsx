'use client';

import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { fetchWaybackForYear, getWaybackTileUrlForYear, getWaybackAttribution } from '@/lib/wayback';

import { TileLayer as LeafletTileLayer } from 'leaflet';

interface WaybackLayerProps {
  year: number;
  onInfoLoaded?: (info: { releaseDate: string | null; releaseId: number | null }) => void;
  onError?: () => void;
  onLayerReady?: (layer: LeafletTileLayer) => void;
  className?: string;
  zIndex?: number;
}

export default function WaybackLayer({ year, onInfoLoaded, onError, onLayerReady, className, zIndex }: WaybackLayerProps) {
  // Start with fallback URL immediately so tiles show right away
  // Use a function to ensure we get the correct URL for the initial year
  const getInitialUrl = () => {
    const url = getWaybackTileUrlForYear(year);
    console.log(`[WaybackLayer ${year}] Initial URL:`, url);
    return url;
  };
  
  const [tileUrl, setTileUrl] = useState<string>(getInitialUrl);
  const [attribution, setAttribution] = useState<string>(() => {
    const attr = getWaybackAttribution(year);
    console.log(`[WaybackLayer ${year}] Initial attribution:`, attr);
    return attr;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    // Only fetch if we don't have a URL yet or if the year changed
    // We can rely on the key prop in parent to reset state when year changes
    // But inside this component, we should be careful.
    
    // Reset to fallback immediately if needed (though initial state handles this)
    const fallbackUrl = getWaybackTileUrlForYear(year);
    if (!tileUrl) {
      setTileUrl(fallbackUrl);
      setAttribution(getWaybackAttribution(year));
    }

    async function load() {
      // Don't re-fetch if we already have a valid non-fallback URL for this year
      // (This is a simple optimization, but for now let's just fetch to be safe but check before updating state)
      
      try {
        console.log(`[WaybackLayer ${year}] Fetching from API...`);
        const data = await fetchWaybackForYear(year);
        if (active) {
          console.log(`[WaybackLayer ${year}] API response:`, data);
          
          // Only update state if the URL is different to avoid infinite loops
          // or if we are currently loading
          if (data.url && data.url !== tileUrl) {
            console.log(`[WaybackLayer ${year}] Updating URL to:`, data.url);
            setTileUrl(data.url);
            setAttribution(data.attribution);
          }
          
          setIsLoading(false);
          if (onInfoLoaded) {
            onInfoLoaded({
              releaseDate: data.releaseDate,
              releaseId: data.releaseId
            });
          }
        }
      } catch (err) {
        console.error(`[WaybackLayer ${year}] Failed to load:`, err);
        if (active) setIsLoading(false);
        if (onError) {
          onError();
        }
      }
    }

    load();

    return () => {
      active = false;
    };
    // Exclude onInfoLoaded and onError from dependency array to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // Use year and URL as key to force re-render when either changes
  const layerKey = `${year}-${tileUrl}`;
  
  console.log(`[WaybackLayer ${year}] Rendering TileLayer with URL:`, tileUrl);
  
  return (
    <TileLayer
      key={layerKey}
      ref={(node) => {
          if (node && onLayerReady) {
              console.log(`[WaybackLayer ${year}] Layer ready callback called`);
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
      zIndex={zIndex}
      updateWhenZooming={false}
      updateWhenIdle={true}
      keepBuffer={2}
      eventHandlers={{
        tileerror: (e) => {
          console.error(`[WaybackLayer ${year}] Tile error:`, e);
          if (onError) onError();
        },
        tileload: () => {
          console.log(`[WaybackLayer ${year}] Tile loaded successfully`);
        }
      }}
    />
  );
}

