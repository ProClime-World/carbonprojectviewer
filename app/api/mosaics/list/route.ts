// API endpoint to list all mosaics
import { NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function GET() {
  try {
    const mosaics = await localMosaicStorage.listMosaics();
    return NextResponse.json(mosaics);
  } catch (error) {
    console.error('Error listing mosaics:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
