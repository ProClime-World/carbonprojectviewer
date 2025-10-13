// API endpoint to get storage statistics
import { NextResponse } from 'next/server';
import { localMosaicStorage } from '@/lib/localMosaicStorage';

export async function GET() {
  try {
    const stats = await localMosaicStorage.getStorageStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
