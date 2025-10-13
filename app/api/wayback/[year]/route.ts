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

    // Fetch all Wayback releases
    const apiUrl = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/releases?f=pjson';
    const resp = await fetch(apiUrl, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Wayback API error: ${resp.status}`);
    }
    const data = await resp.json();
    const releases: WaybackRelease[] = data?.releases || [];

    // Pick the latest release on or before Dec 31 of the target year
    const cutoff = new Date(`${year}-12-31T23:59:59Z`).getTime();
    const eligible = (releases as Array<{ releaseId: number; releaseDate: string }>)
      .map((r) => ({ releaseId: r.releaseId, releaseDate: r.releaseDate }))
      .filter((r) => new Date(r.releaseDate).getTime() <= cutoff)
      .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());

    const chosen = eligible[0] || null;

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


