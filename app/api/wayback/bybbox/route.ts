import { NextResponse } from 'next/server';

// Cache for 1 hour to reduce external API calls
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

function parseBbox(param: string | null): [number, number, number, number] | null {
  if (!param) return null;
  const parts = param.split(',').map(Number);
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

interface WaybackItem {
  itemID: string;
  itemTitle: string;
  itemURL: string;
  layerIdentifier: string;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year'));
    const bbox = parseBbox(url.searchParams.get('bbox'));
    if (!year || !bbox) {
      return new Response('Missing year/bbox', { status: 400 });
    }

    // 1) If user pinned specific releases, use them
    let chosen: { releaseId: number; releaseDate: string; itemURL?: string } | null = null;
    const pinnedEnv = process.env.WAYBACK_PINNED ? safeParse(process.env.WAYBACK_PINNED) : null;
    if (pinnedEnv && typeof pinnedEnv[year] === 'number') {
      chosen = { releaseId: pinnedEnv[year], releaseDate: `${year}-01-01` };
    }

    // 2) Otherwise, use global releases list (from S3 config)
    if (!chosen) {
      const relUrl = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
      const r = await fetch(relUrl, { 
        next: { revalidate: 3600 }, // Cache for 1 hour
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      });
      if (!r.ok) throw new Error('Wayback config fetch failed');
      
      const relData: Record<string, WaybackItem> = await r.json();
      
      // Hardcode specific release preferences for consistency if not pinned
      const PREFERRED_RELEASES: Record<number, number> = {
        2017: 4073,  // 2017-06-27
        2021: 13534, // 2021-06-30
        2024: 16453  // 2024-12-12
      };

      if (PREFERRED_RELEASES[year] && relData[PREFERRED_RELEASES[year].toString()]) {
         const rid = PREFERRED_RELEASES[year];
         const item = relData[rid];
         const match = item.itemTitle.match(/Wayback (\d{4}-\d{2}-\d{2})/);
         chosen = {
             releaseId: rid,
             releaseDate: match ? match[1] : `${year}-06-30`,
             itemURL: item.itemURL,
             // @ts-expect-error - temp prop
             ts: 0
         };
      } else {
          const candidates = Object.keys(relData).map(key => {
            const item = relData[key];
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

          const target = new Date(`${year}-07-01T12:00:00Z`).getTime();
          const sorted = candidates.sort((a, b) => Math.abs(a.ts - target) - Math.abs(b.ts - target));
          chosen = sorted[0] || null;
      }
    }

    const baseFallback = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (!chosen) {
      const response = NextResponse.json({ url: baseFallback, attribution: 'Esri World Imagery', releaseId: null, releaseDate: null });
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return response;
    }

    // Use itemURL if available, otherwise construct it
    let urlTemplate = '';
    if (chosen.itemURL) {
        urlTemplate = chosen.itemURL
            .replace('{level}', '{z}')
            .replace('{row}', '{y}')
            .replace('{col}', '{x}');
    } else {
        // Fallback construction for pinned releases without fetched config
        urlTemplate = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${chosen.releaseId}/{z}/{y}/{x}`;
    }

    const response = NextResponse.json({
      url: urlTemplate,
      attribution: 'Esri Wayback Imagery',
      releaseId: chosen.releaseId,
      releaseDate: chosen.releaseDate,
    });
    
    // Add caching headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;
  } catch (e) {
    console.error(e);
    return new Response('Wayback lookup failed', { status: 502 });
  }
}

function safeParse(json: string): Record<string, number> | null {
  try { return JSON.parse(json); } catch { return null; }
}
