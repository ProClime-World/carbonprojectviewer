import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Fetch Wayback config from S3
    const apiUrl = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
    const resp = await fetch(apiUrl, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Wayback config error: ${resp.status}`);
    }
    const data: Record<string, WaybackItem> = await resp.json();

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
      return NextResponse.json({
        url: baseFallback,
        attribution: 'Esri World Imagery',
        releaseId: null,
        releaseDate: null,
      });
    }

    // Replace config placeholders with Leaflet placeholders
    // {level} -> {z}, {row} -> {y}, {col} -> {x}
    const tileUrl = chosen.itemURL
        .replace('{level}', '{z}')
        .replace('{row}', '{y}')
        .replace('{col}', '{x}');

    return NextResponse.json({
      url: tileUrl,
      attribution: 'Esri Wayback Imagery',
      releaseId: chosen.releaseId,
      releaseDate: chosen.releaseDate,
    });

  } catch (err) {
    console.error('Wayback endpoint error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
