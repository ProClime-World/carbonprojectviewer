// API endpoint to get mosaic info
import { NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function POST(request: Request) {
  try {
    const { year, bbox } = await request.json();
    
    if (!year || !bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return new Response('Invalid parameters', { status: 400 });
    }

    const info = await localMosaicStorage.getMosaicInfo(year, bbox as [number, number, number, number]);
    
    if (!info) {
      return new Response('Mosaic not found', { status: 404 });
    }

    return NextResponse.json(info);
  } catch (error) {
    console.error('Error getting mosaic info:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
