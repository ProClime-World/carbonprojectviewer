// Earth Search STAC API client for satellite imagery
export interface STACItem {
  id: string;
  properties: {
    datetime: string;
    'eo:cloud_cover': number;
    'eo:sun_azimuth': number;
    'eo:sun_elevation': number;
  };
  assets: {
    [key: string]: {
      href: string;
      type: string;
      roles: string[];
    };
  };
}

export interface STACSearchParams {
  bbox: [number, number, number, number]; // [west, south, east, north]
  datetime: string;
  collections: string[];
  limit?: number;
  cloud_cover?: [number, number];
}

export class STACClient {
  private baseUrl = 'https://earth-search.aws.element84.com/v1';

  async search(params: STACSearchParams): Promise<STACItem[]> {
    const queryParams = new URLSearchParams({
      bbox: params.bbox.join(','),
      datetime: params.datetime,
      collections: params.collections.join(','),
      limit: (params.limit || 100).toString(),
    });

    if (params.cloud_cover) {
      queryParams.append('filter', JSON.stringify({
        'eo:cloud_cover': {
          gte: params.cloud_cover[0],
          lte: params.cloud_cover[1]
        }
      }));
    }

    try {
      const response = await fetch(`${this.baseUrl}/search?${queryParams}`);
      if (!response.ok) {
        throw new Error(`STAC API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error('STAC search error:', error);
      return [];
    }
  }

  getImageryForYear(year: number, bbox: [number, number, number, number]): Promise<STACItem[]> {
    const collections = this.getCollectionsForYear(year);
    const datetime = `${year}-01-01/${year}-12-31`;
    
    return this.search({
      bbox,
      datetime,
      collections,
      limit: 50,
      cloud_cover: [0, 20] // 0-20% cloud cover
    });
  }

  private getCollectionsForYear(year: number): string[] {
    if (year <= 2017) {
      return ['landsat-c2-l2']; // Landsat 8 for older years
    } else if (year <= 2021) {
      return ['sentinel-2-l2a', 'landsat-c2-l2']; // Both Sentinel-2 and Landsat
    } else {
      return ['sentinel-2-l2a']; // Sentinel-2 for recent years
    }
  }

  // Get the best imagery tile URL for a given item
  getTileUrl(item: STACItem, zoom: number, x: number, y: number): string | null {
    // Look for RGB composite or visual assets
    const visualAsset = item.assets['visual'] || item.assets['B04'] || item.assets['red'];
    if (visualAsset) {
      // For now, return a placeholder - in a real implementation, you'd need to
      // process the STAC item to get the actual tile URL
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
    }
    return null;
  }
}

export const stacClient = new STACClient();
