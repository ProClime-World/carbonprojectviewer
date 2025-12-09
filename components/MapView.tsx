'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate } from '@/lib/kmlParser';
import WaybackLayer from './WaybackLayer';

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
  selectedIndex?: number | null;
  onSelectPolygon?: (index: number) => void;
}

function MapController({ polygons, selectedIndex }: { polygons: { coordinates: Coordinate[][] }[]; selectedIndex: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (polygons.length > 0) {
      const sourcePolys = selectedIndex !== null && selectedIndex !== undefined && polygons[selectedIndex]
        ? [polygons[selectedIndex]]
        : polygons;
      const allCoords = sourcePolys.flatMap(p => p.coordinates.flat());
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(
          allCoords.map(c => [c.lat, c.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      }
    }
  }, [polygons, selectedIndex, map]);

  return null;
}

export default function MapView({ polygons, selectedYear, selectedIndex = null, onSelectPolygon }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Force map re-render
  const [waybackInfo, setWaybackInfo] = useState<{ releaseDate: string | null; releaseId: number | null }>({ releaseDate: null, releaseId: null });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Log year changes and force map update
  useEffect(() => {
    console.log(`📅 Year changed to: ${selectedYear}`);
    setMapKey(prev => prev + 1); // Force map re-render
  }, [selectedYear]);

  // Calculate bounding box from polygons or selected polygon using useMemo
  const boundingBox = useMemo((): [number, number, number, number] => {
    console.log('🗺️ Calculating bounding box for', polygons.length, 'polygons');
    
    if (polygons.length === 0) {
      console.log('🗺️ No polygons, using global fallback');
      return [-180, -90, 180, 90]; // Global fallback
    }
    
    try {
      const sourcePolys = selectedIndex !== null && selectedIndex !== undefined && polygons[selectedIndex]
        ? [polygons[selectedIndex]]
        : polygons;
      const allCoords = sourcePolys.flatMap(p => p.coordinates.flat());
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
  }, [polygons, selectedIndex]);

  const handleWaybackLoaded = (info: { releaseDate: string | null; releaseId: number | null }) => {
    setWaybackInfo(info);
    console.log(`✅ Wayback loaded: Release ${info.releaseId} (${info.releaseDate})`);
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
          <div className="font-medium">Wayback Imagery {selectedYear}</div>
          <div className="text-xs text-gray-500">
            {waybackInfo.releaseId
              ? `Release ${waybackInfo.releaseId} • ${waybackInfo.releaseDate || 'Unknown Date'}`
              : 'Loading satellite data...'
            }
          </div>
        </div>
      </div>

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
        <WaybackLayer
          year={selectedYear}
          onInfoLoaded={handleWaybackLoaded}
        />
        {polygons.map((polygon, idx) =>
          polygon.coordinates.map((coords, coordIdx) => {
            const isSelected = selectedIndex === idx;
            return (
              <Polygon
                key={`${idx}-${coordIdx}`}
                positions={coords.map(c => [c.lat, c.lng] as [number, number])}
                pathOptions={{
                  color: isSelected ? '#f59e0b' : '#2d1b4e',
                  fillColor: isSelected ? '#f59e0b' : '#2d1b4e',
                  fillOpacity: isSelected ? 0.25 : 0.12,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectPolygon?.(idx),
                }}
              />
            );
          })
        )}
        <MapController polygons={polygons} selectedIndex={selectedIndex} />
      </MapContainer>
    </div>
  );
}

