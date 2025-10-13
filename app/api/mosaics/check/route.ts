// API endpoint to check if a mosaic exists locally
import { NextRequest, NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function POST(request: NextRequest) {
  try {
    const { year, bbox } = await request.json();
    
    if (!year || !bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return new NextResponse('Invalid parameters', { status: 400 });
    }

    const exists = await localMosaicStorage.hasMosaic(year, bbox);
    
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking mosaic:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
