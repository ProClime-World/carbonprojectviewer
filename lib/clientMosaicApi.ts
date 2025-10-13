// Client-side API for checking local mosaics
// This runs in the browser and communicates with the server-side API

export interface LocalMosaicInfo {
  year: number;
  bbox: [number, number, number, number];
  hash: string;
  downloadDate: string;
  tileCount: number;
  totalSize: number;
  scenes: string[];
}

export class ClientMosaicApi {
  private baseUrl = '/api/mosaics';

  // Check if a mosaic exists locally
  async hasMosaic(year: number, bbox: [number, number, number, number]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year, bbox }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.exists;
    } catch (error) {
      console.warn('Error checking for local mosaic:', error);
      return false;
    }
  }

  // Get local mosaic info
  async getMosaicInfo(year: number, bbox: [number, number, number, number]): Promise<LocalMosaicInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year, bbox }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Error getting mosaic info:', error);
      return null;
    }
  }

  // Get tile URL for serving
  getTileUrl(year: number, bbox: [number, number, number, number], z: number, x: number, y: number, format: 'png' | 'jpg' | 'webp' = 'png'): string {
    // Generate hash on client side (same logic as server)
    const config = {
      year,
      bbox: bbox.map(coord => Math.round(coord * 1000) / 1000)
    };
    const hash = this.generateHash(JSON.stringify(config));
    return `/api/mosaic-tiles/${hash}/${z}/${x}/${y}.${format}`;
  }

  // List all available mosaics
  async listMosaics(): Promise<LocalMosaicInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/list`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.warn('Error listing mosaics:', error);
      return [];
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{
    totalMosaics: number;
    totalSize: number;
    totalTiles: number;
    mosaics: LocalMosaicInfo[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);
      if (!response.ok) {
        return { totalMosaics: 0, totalSize: 0, totalTiles: 0, mosaics: [] };
      }
      return await response.json();
    } catch (error) {
      console.warn('Error getting storage stats:', error);
      return { totalMosaics: 0, totalSize: 0, totalTiles: 0, mosaics: [] };
    }
  }

  // Generate hash (client-side version)
  private generateHash(str: string): string {
    // Simple hash function for client-side use
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

export const clientMosaicApi = new ClientMosaicApi();
