// Esri Wayback Imagery helper
// Provides tile URLs for specific historical releases when available.

type YearToTileUrl = Record<number, string>;

// Configure known Wayback releases here per year.
// If a year is not configured, we fall back to Esri World Imagery.
// Pre-pin distinct Wayback releases for demo/consistency. Adjust as needed.
const YEAR_TO_WAYBACK: YearToTileUrl = {
  // 2017-06-27 (Release 4073) - Mid-year
  2017: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/4073/{z}/{y}/{x}',
  // 2021-06-30 (Release 13534) - Mid-year
  2021: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/13534/{z}/{y}/{x}',
  // 2024-12-12 (Release 16453) - December
  2024: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/16453/{z}/{y}/{x}',
};

const DEFAULT_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export function getWaybackTileUrlForYear(year: number): string {
  return YEAR_TO_WAYBACK[year] || DEFAULT_ESRI;
}

export function getWaybackAttribution(year: number): string {
  return YEAR_TO_WAYBACK[year]
    ? 'Esri Wayback Imagery'
    : 'Esri World Imagery';
}

// In-memory cache for wayback URLs (per session)
const waybackCache = new Map<number, { url: string; attribution: string; releaseId: number | null; releaseDate: string | null }>();

export async function fetchWaybackForYear(year: number): Promise<{ url: string; attribution: string; releaseId: number | null; releaseDate: string | null; }> {
  // Check in-memory cache first
  if (waybackCache.has(year)) {
    return waybackCache.get(year)!;
  }
  
  try {
    // Use cache-first strategy - browser will cache based on API route headers
    // The API route sets Cache-Control headers, so browser will respect them
    const resp = await fetch(`/api/wayback/${year}`, { 
      cache: 'default' // Use browser's default caching (respects Cache-Control headers)
    });
    if (!resp.ok) throw new Error('Wayback fetch failed');
    const data = await resp.json();
    
    // Cache in memory for this session
    if (data?.url && data?.attribution) {
      YEAR_TO_WAYBACK[year] = data.url;
      waybackCache.set(year, data);
    }
    return data;
  } catch {
    const fallbackUrl = YEAR_TO_WAYBACK[year] || DEFAULT_ESRI;
    const fallbackAttr = YEAR_TO_WAYBACK[year] ? 'Esri Wayback Imagery' : 'Esri World Imagery';
    const fallback = { url: fallbackUrl, attribution: fallbackAttr, releaseId: null, releaseDate: null };
    waybackCache.set(year, fallback);
    return fallback;
  }
}


