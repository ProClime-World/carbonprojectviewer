'use client';

import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { sentinelMosaicService, SentinelItem } from '@/lib/sentinelMosaic';
import { clientMosaicApi, LocalMosaicInfo } from '@/lib/clientMosaicApi';

interface SentinelMosaicLayerProps {
  year: number;
  bbox: [number, number, number, number];
  onMosaicLoaded?: (items: SentinelItem[]) => void;
}

export default function SentinelMosaicLayer({ 
  year, 
  bbox, 
  onMosaicLoaded 
}: SentinelMosaicLayerProps) {
  const [mosaicItems, setMosaicItems] = useState<SentinelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalMosaic, setHasLocalMosaic] = useState(false);
  const [localMosaicInfo, setLocalMosaicInfo] = useState<LocalMosaicInfo | null>(null);

  useEffect(() => {
    loadMosaicForYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, bbox]);

  const loadMosaicForYear = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🛰️ Loading Sentinel-2 mosaic for ${year}...`);
      
      // First check if we have a local mosaic
      const hasLocal = await clientMosaicApi.hasMosaic(year, bbox);
      
      if (hasLocal) {
        console.log(`📁 Found local mosaic for ${year}`);
        const mosaicInfo = await clientMosaicApi.getMosaicInfo(year, bbox);
        setLocalMosaicInfo(mosaicInfo);
        setHasLocalMosaic(true);
        setIsLoading(false);
        return;
      }
      
      // If no local mosaic, try to fetch from STAC API
      console.log(`🌐 No local mosaic found, fetching from STAC API...`);
      const config = sentinelMosaicService.getMosaicConfig(year, bbox);
      const items = await sentinelMosaicService.getMosaicForYear(config);
      
      if (items.length > 0) {
        const bestScenes = sentinelMosaicService.selectBestScenes(items, 5);
        setMosaicItems(bestScenes);
        onMosaicLoaded?.(bestScenes);
        console.log(`✅ Loaded ${bestScenes.length} best scenes for ${year}`);
      } else {
        console.warn(`⚠️ No Sentinel-2 data available for ${year}`);
        setError(`No satellite data available for ${year}`);
      }
      
    } catch (err) {
      console.error('❌ Error loading mosaic:', err);
      console.log('🔄 Falling back to default imagery...');
      setError(`Failed to load ${year} imagery - using fallback`);
      // Don't set error state, just use fallback
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  // For now, return a placeholder tile layer
  // In a real implementation, this would generate actual mosaic tiles
  if (isLoading) {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Loading Sentinel-2 mosaic..."
        maxZoom={19}
      />
    );
  }

  if (error) {
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution={`Error: ${error}`}
        maxZoom={19}
      />
    );
  }

  // Use local mosaic tiles if available
  if (hasLocalMosaic && localMosaicInfo) {
    const tileUrl = clientMosaicApi.getTileUrl(year, bbox, 0, 0, 0);
    
    return (
      <TileLayer
        url={tileUrl.replace('/0/0/0.png', '/{z}/{x}/{y}.png')}
        attribution={`Sentinel-2 ${year} (Local) • ${localMosaicInfo.tileCount} tiles`}
        maxZoom={19}
      />
    );
  }

  // Use the first mosaic item to generate tiles (fallback to STAC API)
  if (mosaicItems.length > 0) {
    const primaryItem = mosaicItems[0];
    const tileUrl = sentinelMosaicService.generateMosaicTileUrl(primaryItem, 0, 0, 0);
    
    return (
      <TileLayer
        url={tileUrl}
        attribution={`Sentinel-2 ${year} • ${mosaicItems.length} scenes`}
        maxZoom={19}
      />
    );
  }

  // Fallback to default imagery
  return (
    <TileLayer
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      attribution={`Sentinel-2 ${year} (Fallback) • ESA/Copernicus`}
      maxZoom={19}
    />
  );
}
