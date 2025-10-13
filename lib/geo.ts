// Simple geospatial utilities for client-side usage

export interface LatLng {
  lat: number;
  lng: number;
}

// Project lat/lng to Web Mercator (EPSG:3857) in meters
function projectWebMercator(coord: LatLng): { x: number; y: number } {
  const R = 6378137; // meters
  const x = (coord.lng * Math.PI * R) / 180;
  const y =
    Math.log(Math.tan(Math.PI / 4 + (coord.lat * Math.PI) / 360)) * R;
  return { x, y };
}

// Compute polygon area using the shoelace formula on projected coords (m^2)
export function computePolygonAreaSqKm(coords: LatLng[]): number {
  if (!coords || coords.length < 3) return 0;
  const projected = coords.map(projectWebMercator);
  let sum = 0;
  for (let i = 0; i < projected.length; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % projected.length];
    sum += a.x * b.y - b.x * a.y;
  }
  const areaM2 = Math.abs(sum) / 2;
  return areaM2 / 1_000_000; // convert to km^2
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



