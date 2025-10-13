// Esri Wayback Imagery helper
// Provides tile URLs for specific historical releases when available.

type YearToTileUrl = Record<number, string>;

// Configure known Wayback releases here per year.
// If a year is not configured, we fall back to Esri World Imagery.
const YEAR_TO_WAYBACK: YearToTileUrl = {};

const DEFAULT_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export function getWaybackTileUrlForYear(year: number): string {
  return YEAR_TO_WAYBACK[year] || DEFAULT_ESRI;
}

export function getWaybackAttribution(year: number): string {
  return YEAR_TO_WAYBACK[year]
    ? 'Esri Wayback Imagery'
    : 'Esri World Imagery';
}

export async function fetchWaybackForYear(year: number): Promise<{ url: string; attribution: string; releaseId: number | null; releaseDate: string | null; }> {
  try {
    const resp = await fetch(`/api/wayback/${year}`, { cache: 'force-cache' });
    if (!resp.ok) throw new Error('Wayback fetch failed');
    const data = await resp.json();
    // Cache in memory for this session
    if (data?.url && data?.attribution) {
      YEAR_TO_WAYBACK[year] = data.url;
    }
    return data;
  } catch (e) {
    return { url: DEFAULT_ESRI, attribution: 'Esri World Imagery', releaseId: null, releaseDate: null };
  }
}


