import { NextRequest, NextResponse } from 'next/server';

interface WaybackRelease {
  releaseId: number;
  releaseDate: string; // ISO date
}

export async function GET(
  request: NextRequest,
  { params }: { params: { year: string } }
) {
  try {
    const year = parseInt(params.year, 10);
    if (isNaN(year)) {
      return new NextResponse('Invalid year', { status: 400 });
    }

    // Fetch all Wayback releases
    const url = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/releases?f=pjson';
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Wayback API error: ${resp.status}`);
    }
    const data = await resp.json();
    const releases: WaybackRelease[] = data?.releases || [];

    // Pick the latest release on or before Dec 31 of the target year
    const cutoff = new Date(`${year}-12-31T23:59:59Z`).getTime();
    const eligible = releases
      .map((r: any) => ({ releaseId: r.releaseId, releaseDate: r.releaseDate }))
      .filter((r: WaybackRelease) => new Date(r.releaseDate).getTime() <= cutoff)
      .sort((a: WaybackRelease, b: WaybackRelease) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());

    const chosen = eligible[0] || null;

    const baseFallback = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    if (!chosen) {
      return NextResponse.json({
        url: baseFallback,
        attribution: 'Esri World Imagery',
        releaseId: null,
        releaseDate: null,
      }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
    }

    const tileUrl = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseId=${chosen.releaseId}`;

    return NextResponse.json({
      url: tileUrl,
      attribution: 'Esri Wayback Imagery',
      releaseId: chosen.releaseId,
      releaseDate: chosen.releaseDate,
    }, { headers: { 'Cache-Control': 'public, max-age=86400' } });

  } catch (err) {
    console.error('Wayback endpoint error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


