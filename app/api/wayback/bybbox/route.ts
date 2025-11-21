import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseBbox(param: string | null): [number, number, number, number] | null {
  if (!param) return null;
  const parts = param.split(',').map(Number);
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
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
    let chosen: { releaseId: number; releaseDate: string } | null = null;
    const pinnedEnv = process.env.WAYBACK_PINNED ? safeParse(process.env.WAYBACK_PINNED) : null;
    if (pinnedEnv && typeof pinnedEnv[year] === 'number') {
      chosen = { releaseId: pinnedEnv[year], releaseDate: `${year}-01-01` };
    }

    // 2) Otherwise, use global releases list (no token required)
    if (!chosen) {
      const relUrl = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/releases?f=pjson';
      const r = await fetch(relUrl, { cache: 'no-store' });
      const relData = await r.json();
      const releases: Array<{ releaseId: number; releaseDate: string }> = relData?.releases || [];
      // Prefer releases within the target year; else closest to mid-year
      const inYear = releases.filter((rr) => new Date(rr.releaseDate).getUTCFullYear() === year);
      const target = new Date(`${year}-07-01T12:00:00Z`).getTime();
      const pool = (inYear.length > 0 ? inYear : releases)
        .map((rr) => ({ ...rr, ts: new Date(rr.releaseDate).getTime() }))
        .sort((a, b) => Math.abs(a.ts - target) - Math.abs(b.ts - target));
      chosen = pool[0] || null;
    }

    const baseFallback = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (!chosen) {
      return NextResponse.json({ url: baseFallback, attribution: 'Esri World Imagery', releaseId: null, releaseDate: null });
    }

    const urlTemplate = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseId=${chosen.releaseId}`;
    return NextResponse.json({
      url: urlTemplate,
      attribution: 'Esri Wayback Imagery',
      releaseId: chosen.releaseId,
      releaseDate: chosen.releaseDate,
    });
  } catch (e) {
    return new Response('Wayback lookup failed', { status: 502 });
  }
}

function safeParse(json: string): Record<string, number> | null {
  try { return JSON.parse(json); } catch { return null; }
}

