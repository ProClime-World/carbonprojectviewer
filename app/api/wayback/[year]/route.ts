import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

// Cache the wayback config for 1 hour (3600 seconds)
// This reduces external API calls significantly
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

// Maximum execution time for this route (Vercel Pro: 60s for Hobby, 300s for Pro)
export const maxDuration = 10; // 10 seconds max

interface WaybackItem {
  itemID: string;
  itemTitle: string;
  itemURL: string;
  layerIdentifier: string;
}

export async function GET(_req: Request) {
  try {
    const urlObj = new URL(_req.url);
    // Expect path like /api/wayback/{year}
    const segments = urlObj.pathname.split('/').filter(Boolean);
    const yearStr = segments[segments.length - 1];
    const year = parseInt(yearStr || '', 10);
    if (isNaN(year)) {
      return new NextResponse('Invalid year', { status: 400 });
    }

    // Prefer the release closest to mid-year so each year has a distinct slice

    // Fetch Wayback config from S3 with caching and timeout
    // Cache for 1 hour to reduce external API calls
    const apiUrl = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
    const resp = await fetchWithTimeout(apiUrl, { 
      timeout: 5000, // 5 second timeout
      retries: 2, // Retry twice on failure
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
    if (!resp.ok) {
      throw new Error(`Wayback config error: ${resp.status}`);
    }
    const data: Record<string, WaybackItem> = await resp.json();

    // Hardcode specific release preferences for consistency
    const PREFERRED_RELEASES: Record<number, number> = {
      2017: 4073,  // 2017-06-27
      2021: 13534, // 2021-06-30
      2024: 16453  // 2024-12-12
    };

    if (PREFERRED_RELEASES[year]) {
      const rid = PREFERRED_RELEASES[year];
      const item = data[rid.toString()];
      if (item) {
        const match = item.itemTitle.match(/Wayback (\d{4}-\d{2}-\d{2})/);
        const tileUrl = item.itemURL
            .replace('{level}', '{z}')
            .replace('{row}', '{y}')
            .replace('{col}', '{x}');
            
        const response = NextResponse.json({
          url: tileUrl,
          attribution: 'Esri Wayback Imagery',
          releaseId: rid,
          releaseDate: match ? match[1] : null,
        });
        
        // Add caching headers for better performance
        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return response;
      }
    }

    const targetTs = new Date(`${year}-07-01T12:00:00Z`).getTime();
    
    const candidates = Object.keys(data).map(key => {
        const item = data[key];
        // Title format: "World Imagery (Wayback 2014-02-20)"
        const match = item.itemTitle.match(/Wayback (\d{4}-\d{2}-\d{2})/);
        if (!match) return null;
        
        const dateStr = match[1];
        const date = new Date(dateStr);
        if (date.getUTCFullYear() !== year) return null;
        
        return {
            releaseId: parseInt(key, 10),
            releaseDate: dateStr,
            itemURL: item.itemURL,
            ts: date.getTime()
        };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const sortedByCloseness = candidates.sort((a, b) => Math.abs(a.ts - targetTs) - Math.abs(b.ts - targetTs));

    const chosen = sortedByCloseness[0] || null;

    const baseFallback = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    if (!chosen) {
      const response = NextResponse.json({
        url: baseFallback,
        attribution: 'Esri World Imagery',
        releaseId: null,
        releaseDate: null,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return response;
    }

    // Replace config placeholders with Leaflet placeholders
    // {level} -> {z}, {row} -> {y}, {col} -> {x}
    const tileUrl = chosen.itemURL
        .replace('{level}', '{z}')
        .replace('{row}', '{y}')
        .replace('{col}', '{x}');

    const response = NextResponse.json({
      url: tileUrl,
      attribution: 'Esri Wayback Imagery',
      releaseId: chosen.releaseId,
      releaseDate: chosen.releaseDate,
    });
    
    // Add caching headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;

  } catch (err) {
    console.error('Wayback endpoint error:', err);
    
    // Return fallback response instead of error to prevent app crashes
    const fallbackUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const response = NextResponse.json({
      url: fallbackUrl,
      attribution: 'Esri World Imagery (Fallback)',
      releaseId: null,
      releaseDate: null,
    }, { status: 200 }); // Return 200 with fallback instead of 500
    
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  }
}
