// API endpoint to get mosaic info
import { NextRequest, NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function POST(request: NextRequest) {
  try {
    const { year, bbox } = await request.json();
    
    if (!year || !bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return new NextResponse('Invalid parameters', { status: 400 });
    }

    const info = await localMosaicStorage.getMosaicInfo(year, bbox);
    
    if (!info) {
      return new NextResponse('Mosaic not found', { status: 404 });
    }

    return NextResponse.json(info);
  } catch (error) {
    console.error('Error getting mosaic info:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
