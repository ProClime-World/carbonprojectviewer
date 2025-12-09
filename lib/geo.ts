// Simple geospatial utilities for client-side usage

export interface LatLng {
  lat: number;
  lng: number;
}

// Helper to convert degrees to radians
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Compute geodesic polygon area on a sphere (meters^2)
export function computePolygonAreaSqKm(coords: LatLng[]): number {
  if (!coords || coords.length < 3) return 0;
  
  const R = 6378137; // Earth radius in meters
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    
    // Formula for area on a sphere
    area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  
  area = (area * R * R) / 2.0;
  return Math.abs(area) / 1_000_000; // convert to km^2
}

export function formatAreaKm2(areaKm2: number): string {
  if (areaKm2 >= 100) return `${areaKm2.toFixed(0)} km²`;
  if (areaKm2 >= 10) return `${areaKm2.toFixed(1)} km²`;
  return `${areaKm2.toFixed(2)} km²`;
}

export function km2ToHectares(areaKm2: number): number {
  return areaKm2 * 100; // 1 km² = 100 hectares
}

export function formatAreaHa(areaHa: number): string {
  if (areaHa >= 1000) return `${(areaHa / 1000).toFixed(1)}k ha`;
  if (areaHa >= 100) return `${areaHa.toFixed(0)} ha`;
  if (areaHa >= 10) return `${areaHa.toFixed(1)} ha`;
  return `${areaHa.toFixed(2)} ha`;
}
