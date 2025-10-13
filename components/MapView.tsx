'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate } from '@/lib/kmlParser';
import { SentinelItem } from '@/lib/sentinelMosaic';
import SentinelMosaicLayer from './SentinelMosaicLayer';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl as unknown as undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  polygons: { coordinates: Coordinate[][] }[];
  selectedYear: number;
}

function MapController({ polygons }: { polygons: { coordinates: Coordinate[][] }[] }) {
  const map = useMap();

  useEffect(() => {
    if (polygons.length > 0 && polygons[0].coordinates.length > 0) {
      const allCoords = polygons.flatMap(p => p.coordinates.flat());
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(
          allCoords.map(c => [c.lat, c.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      }
    }
  }, [polygons, map]);

  return null;
}

export default function MapView({ polygons, selectedYear }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Force map re-render
  const [mosaicItems, setMosaicItems] = useState<SentinelItem[]>([]);
  const [isLoadingMosaic] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Log year changes and force map update
  useEffect(() => {
    console.log(`📅 Year changed to: ${selectedYear}`);
    setMapKey(prev => prev + 1); // Force map re-render
  }, [selectedYear]);

  // Calculate bounding box from polygons using useMemo to prevent infinite loops
  const boundingBox = useMemo((): [number, number, number, number] => {
    console.log('🗺️ Calculating bounding box for', polygons.length, 'polygons');
    
    if (polygons.length === 0) {
      console.log('🗺️ No polygons, using global fallback');
      return [-180, -90, 180, 90]; // Global fallback
    }
    
    try {
      const allCoords = polygons.flatMap(p => p.coordinates.flat());
      if (allCoords.length === 0) {
        console.log('🗺️ No coordinates found, using global fallback');
        return [-180, -90, 180, 90]; // Global fallback
      }
      
      const lats = allCoords.map(c => c.lat).filter(lat => !isNaN(lat));
      const lngs = allCoords.map(c => c.lng).filter(lng => !isNaN(lng));
      
      if (lats.length === 0 || lngs.length === 0) {
        console.log('🗺️ Invalid coordinates, using global fallback');
        return [-180, -90, 180, 90]; // Global fallback
      }
      
      const bbox: [number, number, number, number] = [
        Math.min(...lngs), // west
        Math.min(...lats), // south
        Math.max(...lngs), // east
        Math.max(...lats)  // north
      ];
      
      console.log('🗺️ Calculated bounding box:', bbox);
      return bbox;
      
    } catch (error) {
      console.error('🗺️ Error calculating bounding box:', error);
      return [-180, -90, 180, 90]; // Global fallback
    }
  }, [polygons]);

  const handleMosaicLoaded = (items: SentinelItem[]) => {
    setMosaicItems(items);
    console.log(`✅ Mosaic loaded: ${items.length} Sentinel-2 scenes for ${selectedYear}`);
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p>Loading map...</p>
      </div>
    );
  }

  // Attribution handled inside layers

  return (
    <div className="relative w-full h-full">
      {/* Year info */}
      <div className="absolute top-4 left-4 z-10 bg-white bg-opacity-90 px-3 py-2 rounded-md shadow-md">
        <div className="text-sm text-gray-700">
          <div className="font-medium">Sentinel-2 {selectedYear} Mosaic</div>
          <div className="text-xs text-gray-500">
            {mosaicItems.length > 0 
              ? `${mosaicItems.length} scenes • ESA/Copernicus`
              : 'Loading satellite data...'
            }
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoadingMosaic && (
        <div className="absolute top-4 right-4 z-10 bg-blue-500 text-white px-3 py-2 rounded-md shadow-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm">Generating {selectedYear} mosaic...</span>
          </div>
        </div>
      )}

      <MapContainer
        key={mapKey} // Force re-render when year changes
        center={[0, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* Base map imagery */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri World Imagery"
          maxZoom={19}
        />
        <SentinelMosaicLayer
          year={selectedYear}
          bbox={boundingBox}
          onMosaicLoaded={handleMosaicLoaded}
        />
        {polygons.map((polygon, idx) =>
          polygon.coordinates.map((coords, coordIdx) => (
            <Polygon
              key={`${idx}-${coordIdx}`}
              positions={coords.map(c => [c.lat, c.lng] as [number, number])}
              pathOptions={{
                color: '#2d1b4e',
                fillColor: '#2d1b4e',
                fillOpacity: 0.2,
                weight: 2,
              }}
            />
          ))
        )}
        <MapController polygons={polygons} />
      </MapContainer>
    </div>
  );
}

