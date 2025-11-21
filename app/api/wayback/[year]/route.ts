import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WaybackRelease {
  releaseId: number;
  releaseDate: string; // ISO date
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

    // Fetch all Wayback releases
    const apiUrl = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/releases?f=pjson';
    const resp = await fetch(apiUrl, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Wayback API error: ${resp.status}`);
    }
    const data = await resp.json();
    const releases: WaybackRelease[] = data?.releases || [];

    const targetTs = new Date(`${year}-07-01T12:00:00Z`).getTime();
    const sortedByCloseness = (releases as Array<{ releaseId: number; releaseDate: string }>)
      .map((r) => ({ releaseId: r.releaseId, releaseDate: r.releaseDate, ts: new Date(r.releaseDate).getTime() }))
      .sort((a, b) => Math.abs(a.ts - targetTs) - Math.abs(b.ts - targetTs));

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

    const tileUrl = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseId=${chosen.releaseId}`;

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


