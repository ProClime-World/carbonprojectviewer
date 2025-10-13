// Mosaic Downloader and Processor
// Downloads Sentinel-2 data and creates mosaic tiles

import { sentinelMosaicService, SentinelItem } from './sentinelMosaic';
import { localMosaicStorage, LocalMosaicInfo } from './localMosaicStorage';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface DownloadProgress {
  stage: 'searching' | 'downloading' | 'processing' | 'tiling' | 'complete';
  progress: number; // 0-100
  message: string;
  currentTile?: { z: number; x: number; y: number };
  totalTiles?: number;
}

export class MosaicDownloader {
  private onProgress?: (progress: DownloadProgress) => void;

  constructor(onProgress?: (progress: DownloadProgress) => void) {
    this.onProgress = onProgress;
  }

  // Download and process a mosaic for a specific year and bbox
  async downloadMosaic(
    year: number, 
    bbox: [number, number, number, number],
    maxZoom: number = 10,
    tileSize: number = 256
  ): Promise<LocalMosaicInfo> {
    this.reportProgress('searching', 0, 'Searching for Sentinel-2 data...');

    // Get mosaic configuration
    const config = sentinelMosaicService.getMosaicConfig(year, bbox);
    
    // Check if mosaic already exists
    const existingMosaic = await localMosaicStorage.getMosaicInfo(year, bbox);
    if (existingMosaic) {
      this.reportProgress('complete', 100, 'Mosaic already exists locally');
      return existingMosaic;
    }

    // Query Sentinel-2 data
    const items = await sentinelMosaicService.getMosaicForYear(config);
    
    if (items.length === 0) {
      throw new Error(`No Sentinel-2 data found for ${year}`);
    }

    this.reportProgress('downloading', 20, `Found ${items.length} scenes, downloading...`);

    // Select best scenes
    const bestScenes = sentinelMosaicService.selectBestScenes(items, 5);
    
    // Download and process scenes
    const processedScenes = await this.processScenes(bestScenes);
    
    this.reportProgress('tiling', 60, 'Generating tiles...');

    // Generate tiles
    const tileCount = await this.generateTiles(
      processedScenes, 
      year, 
      bbox, 
      maxZoom, 
      tileSize
    );

    // Create mosaic info
    const mosaicInfo: LocalMosaicInfo = {
      year,
      bbox,
      hash: localMosaicStorage.generateMosaicHash(year, bbox),
      downloadDate: new Date().toISOString(),
      tileCount,
      totalSize: await this.calculateTotalSize(year, bbox),
      scenes: bestScenes.map(item => item.id)
    };

    // Save metadata
    await localMosaicStorage.saveMosaicInfo(mosaicInfo);

    this.reportProgress('complete', 100, `Mosaic complete with ${tileCount} tiles`);
    
    return mosaicInfo;
  }

  private async processScenes(scenes: SentinelItem[]) {
    const processedScenes: Array<{ id: string; data: Buffer; properties: SentinelItem['properties'] }> = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const progress = 20 + (i / scenes.length) * 40; // 20-60%
      
      this.reportProgress('downloading', progress, `Processing scene ${i + 1}/${scenes.length}`);

      try {
        // Download the visual asset (RGB composite)
        if (scene.assets.visual?.href) {
          const response = await fetch(scene.assets.visual.href);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Process with Sharp for optimization
            const processed = await sharp(buffer)
              .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer();

            processedScenes.push({
              id: scene.id,
              data: processed,
              properties: scene.properties
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to process scene ${scene.id}:`, error);
      }
    }

    return processedScenes;
  }

  private async generateTiles(
    scenes: Array<{ id: string; data: Buffer; properties: SentinelItem['properties'] }>, 
    year: number, 
    bbox: [number, number, number, number],
    maxZoom: number,
    tileSize: number
  ): Promise<number> {
    let totalTiles = 0;
    const totalZoomLevels = maxZoom + 1;

    for (let z = 0; z <= maxZoom; z++) {
      const tilesAtZoom = Math.pow(2, z);
      const progress = 60 + (z / totalZoomLevels) * 35; // 60-95%
      
      this.reportProgress('tiling', progress, `Generating zoom level ${z}/${maxZoom}`);

      for (let x = 0; x < tilesAtZoom; x++) {
        for (let y = 0; y < tilesAtZoom; y++) {
          // Generate tile from scenes
          const tileData = await this.generateTileFromScenes(scenes, z, x, y, tileSize);
          
          if (tileData) {
            await localMosaicStorage.saveTile(year, bbox, z, x, y, tileData, 'png');
            totalTiles++;
          }

          this.reportProgress('tiling', progress, `Tile ${x},${y} at zoom ${z}`, { z, x, y }, totalTiles);
        }
      }
    }

    return totalTiles;
  }

  private async generateTileFromScenes(
    scenes: Array<{ id: string; data: Buffer; properties: SentinelItem['properties'] }>, 
    z: number, 
    x: number, 
    y: number, 
    tileSize: number
  ): Promise<Buffer | null> {
    if (scenes.length === 0) return null;

    try {
      // For simplicity, use the first scene
      // In a real implementation, you'd composite multiple scenes
      const scene = scenes[0];
      
      // Create a tile from the scene data
      const tile = await sharp(scene.data)
        .resize(tileSize, tileSize, { fit: 'cover' })
        .png()
        .toBuffer();

      return tile;
    } catch (error) {
      console.error(`Error generating tile ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  private async calculateTotalSize(year: number, bbox: [number, number, number, number]): Promise<number> {
    const hash = localMosaicStorage.generateMosaicHash(year, bbox);
    const mosaicDir = path.join(process.cwd(), 'public', 'data', 'mosaics', 'tiles', hash);
    
    if (!fs.existsSync(mosaicDir)) {
      return 0;
    }

    let totalSize = 0;
    const files = fs.readdirSync(mosaicDir, { recursive: true, encoding: 'utf8' });

    for (const file of files) {
      const filePath = path.join(mosaicDir, file);
      if (fs.statSync(filePath).isFile()) {
        totalSize += fs.statSync(filePath).size;
      }
    }

    return totalSize;
  }

  private reportProgress(
    stage: DownloadProgress['stage'], 
    progress: number, 
    message: string,
    currentTile?: { z: number; x: number; y: number },
    totalTiles?: number
  ) {
    if (this.onProgress) {
      this.onProgress({
        stage,
        progress: Math.round(progress),
        message,
        currentTile,
        totalTiles
      });
    }
  }
}

// Utility function to download mosaics for multiple years
export async function downloadMosaicsForYears(
  years: number[], 
  bbox: [number, number, number, number],
  onProgress?: (year: number, progress: DownloadProgress) => void
): Promise<LocalMosaicInfo[]> {
  const results: LocalMosaicInfo[] = [];

  for (const year of years) {
    if (onProgress) {
      const downloader = new MosaicDownloader((progress) => onProgress(year, progress));
      const result = await downloader.downloadMosaic(year, bbox);
      results.push(result);
    } else {
      const downloader = new MosaicDownloader();
      const result = await downloader.downloadMosaic(year, bbox);
      results.push(result);
    }
  }

  return results;
}
