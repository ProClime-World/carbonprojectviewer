// API endpoint to check if a mosaic exists locally
import { NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function POST(request: Request) {
  try {
    const { year, bbox } = await request.json();
    
    if (!year || !bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return new Response('Invalid parameters', { status: 400 });
    }

    const bboxTuple = [
      Number(bbox[0]),
      Number(bbox[1]),
      Number(bbox[2]),
      Number(bbox[3])
    ] as [number, number, number, number];

    const exists = await localMosaicStorage.hasMosaic(year, bboxTuple);
    
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking mosaic:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
