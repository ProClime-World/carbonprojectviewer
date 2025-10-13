// Sentinel-2 Mosaic Service
// Generates actual satellite imagery mosaics for specific years

export interface MosaicConfig {
  year: number;
  bbox: [number, number, number, number]; // [west, south, east, north]
  cloudCover: number; // 0-100
  startDate: string;
  endDate: string;
}

export interface SentinelItem {
  id: string;
  properties: {
    datetime: string;
    'eo:cloud_cover': number;
    'eo:sun_azimuth': number;
    'eo:sun_elevation': number;
    'sentinel:product_id': string;
  };
  assets: {
    visual?: {
      href: string;
      type: string;
    };
    B04?: { href: string; type: string; }; // Red
    B03?: { href: string; type: string; }; // Green  
    B02?: { href: string; type: string; }; // Blue
  };
  geometry: {
    coordinates: number[][][];
  };
}

export class SentinelMosaicService {
  private stacUrl = 'https://earth-search.aws.element84.com/v1';
  
  async getMosaicForYear(config: MosaicConfig): Promise<SentinelItem[]> {
    console.log(`🛰️ Generating Sentinel-2 mosaic for ${config.year}...`);
    
    try {
      // Query Sentinel-2 data for the specific year
      const items = await this.querySentinelData(config);
      
      if (items.length === 0) {
        console.warn(`⚠️ No Sentinel-2 data found for ${config.year}`);
        return [];
      }
      
      console.log(`✅ Found ${items.length} Sentinel-2 scenes for ${config.year}`);
      return items;
      
    } catch (error) {
      console.error('❌ Error generating mosaic:', error);
      throw error;
    }
  }
  
  private async querySentinelData(config: MosaicConfig): Promise<SentinelItem[]> {
    console.log('🔍 Querying STAC API with config:', config);
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      collections: 'sentinel-2-l2a',
      bbox: config.bbox.join(','),
      datetime: `${config.startDate}/${config.endDate}`,
      limit: '50' // Reduced limit to avoid overwhelming the API
    });
    
    // Add cloud cover filter as a separate parameter
    queryParams.append('filter', JSON.stringify({
      'eo:cloud_cover': {
        lte: config.cloudCover
      }
    }));
    
    const url = `${this.stacUrl}/search?${queryParams}`;
    console.log('🔍 STAC URL:', url);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ STAC API error response:', errorText);
        throw new Error(`STAC API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ STAC API response:', data);
      return data.features || [];
      
    } catch (error) {
      console.error('❌ STAC API request failed:', error);
      throw error;
    }
  }
  
  // Generate mosaic tile URL for a specific item
  generateMosaicTileUrl(item: SentinelItem, z: number, x: number, y: number): string {
    // For now, return a placeholder that would be replaced with actual mosaic processing
    // In a real implementation, this would:
    // 1. Process the Sentinel-2 bands (B02, B03, B04) to create RGB composite
    // 2. Apply cloud masking
    // 3. Generate tiles at the requested zoom level
    // 4. Return the tile URL
    
    const baseUrl = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs';
    const productId = item.properties['sentinel:product_id'];
    
    // This is a simplified example - in reality you'd need proper tile processing
    return `${baseUrl}/${productId}/tiles/10/${z}/${x}/${y}.tif`;
  }
  
  // Get the best scenes for mosaic (lowest cloud cover, best sun angle)
  selectBestScenes(items: SentinelItem[], maxScenes: number = 10): SentinelItem[] {
    return items
      .sort((a, b) => {
        // Sort by cloud cover (ascending) and sun elevation (descending)
        const cloudDiff = a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover'];
        if (cloudDiff !== 0) return cloudDiff;
        return b.properties['eo:sun_elevation'] - a.properties['eo:sun_elevation'];
      })
      .slice(0, maxScenes);
  }
  
  // Generate mosaic configuration for a specific year
  getMosaicConfig(year: number, bbox: [number, number, number, number]): MosaicConfig {
    // Validate and constrain bounding box to reasonable limits
    const constrainedBbox: [number, number, number, number] = [
      Math.max(-180, Math.min(180, bbox[0])), // west
      Math.max(-90, Math.min(90, bbox[1])),  // south
      Math.max(-180, Math.min(180, bbox[2])), // east
      Math.max(-90, Math.min(90, bbox[3]))   // north
    ];
    
    // If bbox is too large (global), use a smaller default area
    const bboxSize = (constrainedBbox[2] - constrainedBbox[0]) * (constrainedBbox[3] - constrainedBbox[1]);
    if (bboxSize > 10000) { // If area is too large
      console.log('⚠️ Bounding box too large, using default area');
      return {
        year,
        bbox: [-74.2, 40.5, -73.8, 40.9] as [number, number, number, number], // NYC area as default
        cloudCover: 20,
        startDate: `${year}-01-01T00:00:00Z`,
        endDate: `${year}-12-31T23:59:59Z`
      };
    }
    
    return {
      year,
      bbox: constrainedBbox,
      cloudCover: 20, // 20% max cloud cover
      startDate: `${year}-01-01T00:00:00Z`,
      endDate: `${year}-12-31T23:59:59Z`
    };
  }
}

export const sentinelMosaicService = new SentinelMosaicService();
