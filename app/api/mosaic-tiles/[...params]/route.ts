// API route for serving mosaic tiles
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function GET(_req: Request) {
  try {
    const url = new URL(_req.url);
    const prefix = '/api/mosaic-tiles/';
    const idx = url.pathname.indexOf(prefix);
    const rest = idx >= 0 ? url.pathname.slice(idx + prefix.length) : '';
    const pathParams = rest.split('/').filter(Boolean);
    
    if (pathParams.length < 4) {
      return new Response('Invalid tile path', { status: 400 });
    }

    const [hash, z, x, yWithExt] = pathParams;
    const [y, ext] = yWithExt.split('.');
    
    if (!z || !x || !y || !ext) {
      return new Response('Invalid tile parameters', { status: 400 });
    }

    const zoom = parseInt(z);
    const tileX = parseInt(x);
    const tileY = parseInt(y);
    const format = ext as 'png' | 'jpg' | 'webp';

    // Validate parameters
    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return new Response('Invalid tile coordinates', { status: 400 });
    }

    if (!['png', 'jpg', 'webp'].includes(format)) {
      return new Response('Unsupported format', { status: 400 });
    }

    // For now, we'll need to find the mosaic by hash
    // In a real implementation, you'd store the hash-to-config mapping
    const mosaics = await localMosaicStorage.listMosaics();
    const mosaic = mosaics.find(m => m.hash === hash);
    
    if (!mosaic) {
      return new Response('Mosaic not found', { status: 404 });
    }

    // Get the tile data
    const tileData = await localMosaicStorage.getTile(
      mosaic.year,
      mosaic.bbox,
      zoom,
      tileX,
      tileY,
      format
    );

    if (!tileData) {
      return new Response('Tile not found', { status: 404 });
    }

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', `image/${format}`);
    headers.set('Content-Length', tileData.length.toString());
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    headers.set('Last-Modified', new Date().toUTCString());

    // Ensure body is a supported BodyInit type
    const body = new Uint8Array(tileData);
    return new Response(body, { status: 200, headers });

  } catch (error) {
    console.error('Error serving tile:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
