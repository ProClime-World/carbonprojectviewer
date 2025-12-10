'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate } from '@/lib/kmlParser';
import WaybackLayer from './WaybackLayer';
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
  yearLeft?: number;
  yearRight?: number;
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

export default function MapView({ polygons, yearLeft = 2017, yearRight = 2024, selectedIndex = null, onSelectPolygon }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Force map re-render
  const [leftInfo, setLeftInfo] = useState<{ releaseDate: string | null; releaseId: number | null }>({ releaseDate: null, releaseId: null });
  const [rightInfo, setRightInfo] = useState<{ releaseDate: string | null; releaseId: number | null }>({ releaseDate: null, releaseId: null });
  const [showResolutionWarning, setShowResolutionWarning] = useState(false);
  
  const [sliderPosition, setSliderPosition] = useState(50);
  const [rightLayer, setRightLayer] = useState<L.TileLayer | null>(null);
  
  // We need access to the map instance for dimensions
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update clipping when slider or right layer changes
  useEffect(() => {
    if (!rightLayer || !mapInstance) return;
    
    const container = rightLayer.getContainer();
    if (!container) {
      // Retry after a short delay if container not ready
      const timeoutId = setTimeout(() => {
        if (rightLayer && mapInstance) {
          const retryContainer = rightLayer.getContainer();
          if (retryContainer) {
            // Re-run the effect by updating a dependency
            setMapKey(prev => prev + 1);
          }
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }

    // Clip the right layer (which is on top) to reveal the left layer
    // We clip the left side of the right layer
    // rect(top, right, bottom, left)
    // We want to show the right layer from X% to 100%
    // So we clip from 0 to X% (hide left part)
    // Standard Leaflet SideBySide uses getRangeInput().value to set clip
    // CSS clip: rect(0, 9999px, 9999px, {position}px)
    
    let updateTimeout: NodeJS.Timeout | null = null;
    const updateClip = () => {
        // Debounce rapid updates
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => {
          const mapContainer = mapInstance.getContainer();
          if (!mapContainer) return;
          
          const rect = mapContainer.getBoundingClientRect();
          if (!rect || rect.width === 0) return;
          
          const width = rect.width;
          const clipX = (width * sliderPosition) / 100;
          
          // Clip the left part of the right layer to show only from sliderPosition% to 100%
          
          // Calculate clip rect relative to the layer container
          // The layer container might be offset relative to the map container
          const layerRect = container.getBoundingClientRect();
          const offsetX = layerRect.left - rect.left;
          const offsetY = layerRect.top - rect.top;
          
          // We want the clip window to start at 'clipX' relative to the map container
          // So relative to the layer container, it starts at 'clipX - offsetX'
          // And extends to the right edge of the map container ('width - offsetX')
          // Top is '-offsetY' and bottom is 'rect.height - offsetY'
          
          const clipLeft = clipX - offsetX;
          const clipRight = width - offsetX;
          const clipTop = -offsetY;
          const clipBottom = rect.height - offsetY;
          
          container.style.clip = `rect(${clipTop}px, ${clipRight}px, ${clipBottom}px, ${clipLeft}px)`;
          // Remove clipPath as it uses percentages relative to the element size, which is wrong for moving layers
          container.style.clipPath = '';
        }, 16); // ~60fps
    };
    
    // Initial update with a small delay to ensure container is ready
    const initTimeout = setTimeout(updateClip, 50);
    
    // Update on map events that might affect positioning
    mapInstance.on('move', updateClip);
    mapInstance.on('zoom', updateClip);
    mapInstance.on('resize', updateClip);
    
    // Also update when window resizes
    const handleResize = () => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(updateClip);
    };
    window.addEventListener('resize', handleResize);
    
    // Update when tiles load (might affect container size)
    rightLayer.on('tileload', updateClip);
    rightLayer.on('load', updateClip);
    
    return () => {
        clearTimeout(initTimeout);
        if (updateTimeout) clearTimeout(updateTimeout);
        mapInstance.off('move', updateClip);
        mapInstance.off('zoom', updateClip);
        mapInstance.off('resize', updateClip);
        window.removeEventListener('resize', handleResize);
        rightLayer.off('tileload', updateClip);
        rightLayer.off('load', updateClip);
    };
  }, [sliderPosition, rightLayer, mapInstance]);

  // Log year changes and force map update (if years change dynamically, though fixed for now)
  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, [yearLeft, yearRight]);

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
      
      // Use iterative min/max to avoid spreading very large arrays (stack overflow)
      let west = Infinity;
      let south = Infinity;
      let east = -Infinity;
      let north = -Infinity;
      let validCount = 0;

      for (const c of allCoords) {
        const { lat, lng } = c;
        if (isNaN(lat) || isNaN(lng)) continue;
        validCount += 1;
        if (lng < west) west = lng;
        if (lat < south) south = lat;
        if (lng > east) east = lng;
        if (lat > north) north = lat;
      }
      
      if (validCount === 0) {
        console.log('🗺️ Invalid coordinates, using global fallback');
        return [-180, -90, 180, 90]; // Global fallback
      }
      
      const bbox: [number, number, number, number] = [west, south, east, north];
      
      console.log('🗺️ Calculated bounding box:', bbox);
      return bbox;
      
    } catch (error) {
      console.error('🗺️ Error calculating bounding box:', error);
      return [-180, -90, 180, 90]; // Global fallback
    }
  }, [polygons, selectedIndex]);

  const handleLeftLoaded = useCallback((info: { releaseDate: string | null; releaseId: number | null }) => {
    setLeftInfo(info);
  }, []);

  const handleRightLoaded = useCallback((info: { releaseDate: string | null; releaseId: number | null }) => {
    setRightInfo(info);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p>Loading map...</p>
      </div>
    );
  }

  // Attribution handled inside layers

  return (
    <div className="relative w-full h-full group">
      {/* Split Screen Slider Control */}
      <div className="absolute inset-0 z-[401] pointer-events-none flex items-center justify-center">
        {/* Slider Line */}
        <div 
            className="absolute top-0 bottom-0 w-1 bg-white shadow-md pointer-events-none cursor-ew-resize hover:bg-gray-100 transition-colors"
            style={{ 
              left: `${sliderPosition}%`,
              transform: 'translateX(-50%)'
            }}
        >
             {/* Handle */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 pointer-events-auto">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" transform="rotate(90 12 12)" />
                </svg>
             </div>
        </div>
        
        {/* Invisible Range Input for Interaction */}
        <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => {
              const newPosition = Number(e.target.value);
              setSliderPosition(newPosition);
            }}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-auto cursor-ew-resize"
            style={{ margin: 0 }}
        />
      </div>

      {/* Year Labels */}
      <div className="absolute top-4 left-4 z-[402] bg-white/90 px-3 py-2 rounded-md shadow-md pointer-events-none border-l-4 border-blue-500">
        <div className="text-sm font-bold text-gray-800">{yearLeft}</div>
        <div className="text-xs text-gray-600">{leftInfo.releaseDate || 'Loading...'}</div>
      </div>
      
      <div className="absolute top-4 right-4 z-[402] bg-white/90 px-3 py-2 rounded-md shadow-md pointer-events-none border-r-4 border-purple-500 text-right">
        <div className="text-sm font-bold text-gray-800">{yearRight}</div>
        <div className="text-xs text-gray-600">{rightInfo.releaseDate || 'Loading...'}</div>
      </div>

      {/* Resolution warning notification */}
      {showResolutionWarning && (
        <div className="absolute top-4 right-4 z-20 bg-amber-100 border border-amber-300 text-amber-800 px-3 py-2 rounded-md shadow-lg transition-opacity duration-300">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Imagery missing at this zoom level</span>
          </div>
          <div className="text-xs text-amber-700 mt-1 pl-7">
            Try zooming out to see the imagery.
          </div>
        </div>
      )}

      <MapContainer
        key={mapKey}
        center={[0, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        ref={setMapInstance}
      >
        {/* Left Layer (Bottom) - 2017 */}
        <WaybackLayer
          key={`left-${yearLeft}`}
          year={yearLeft}
          onInfoLoaded={handleLeftLoaded}
          onError={() => setShowResolutionWarning(true)}
          zIndex={1}
        />
        
        {/* Right Layer (Top, clipped) - 2024 */}
        <WaybackLayer
          key={`right-${yearRight}`}
          year={yearRight}
          onInfoLoaded={handleRightLoaded}
          onLayerReady={setRightLayer}
          className="z-[200]" // Ensure it's on top if using standard panes
          onError={() => setShowResolutionWarning(true)}
          zIndex={10}
        />

        {/* Polygons (Always on top of imagery) */}
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

