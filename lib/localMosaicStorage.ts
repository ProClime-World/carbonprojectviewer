// Local Mosaic Storage System
// Handles downloading, caching, and serving mosaic tiles locally

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface LocalMosaicInfo {
  year: number;
  bbox: [number, number, number, number];
  hash: string;
  downloadDate: string;
  tileCount: number;
  totalSize: number;
  scenes: string[]; // Sentinel scene IDs
}

export interface TileInfo {
  z: number;
  x: number;
  y: number;
  format: 'png' | 'jpg' | 'webp';
  size: number;
  lastModified: string;
}

export class LocalMosaicStorage {
  private storageDir: string;
  private tilesDir: string;
  private metadataFile: string;

  constructor() {
    this.storageDir = path.join(process.cwd(), 'public', 'data', 'mosaics');
    this.tilesDir = path.join(this.storageDir, 'tiles');
    this.metadataFile = path.join(this.storageDir, 'metadata.json');
    
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.tilesDir)) {
      fs.mkdirSync(this.tilesDir, { recursive: true });
    }
  }

  // Generate a unique hash for a mosaic configuration
  generateMosaicHash(year: number, bbox: [number, number, number, number]): string {
    const config = {
      year,
      bbox: bbox.map(coord => Math.round(coord * 1000) / 1000) // Round to 3 decimal places
    };
    return createHash('md5').update(JSON.stringify(config)).digest('hex');
  }

  // Check if a mosaic exists locally
  async hasMosaic(year: number, bbox: [number, number, number, number]): Promise<boolean> {
    const hash = this.generateMosaicHash(year, bbox);
    const mosaicDir = path.join(this.tilesDir, hash);
    return fs.existsSync(mosaicDir) && fs.existsSync(path.join(mosaicDir, 'metadata.json'));
  }

  // Get local mosaic info
  async getMosaicInfo(year: number, bbox: [number, number, number, number]): Promise<LocalMosaicInfo | null> {
    const hash = this.generateMosaicHash(year, bbox);
    const mosaicDir = path.join(this.tilesDir, hash);
    const metadataPath = path.join(mosaicDir, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata;
    } catch (error) {
      console.error('Error reading mosaic metadata:', error);
      return null;
    }
  }

  // Save mosaic metadata
  async saveMosaicInfo(info: LocalMosaicInfo): Promise<void> {
    const hash = info.hash;
    const mosaicDir = path.join(this.tilesDir, hash);
    
    if (!fs.existsSync(mosaicDir)) {
      fs.mkdirSync(mosaicDir, { recursive: true });
    }

    const metadataPath = path.join(mosaicDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(info, null, 2));
  }

  // Save a tile
  async saveTile(
    year: number, 
    bbox: [number, number, number, number], 
    z: number, 
    x: number, 
    y: number, 
    tileData: Buffer, 
    format: 'png' | 'jpg' | 'webp' = 'png'
  ): Promise<void> {
    const hash = this.generateMosaicHash(year, bbox);
    const mosaicDir = path.join(this.tilesDir, hash);
    const tileDir = path.join(mosaicDir, z.toString(), x.toString());
    
    if (!fs.existsSync(tileDir)) {
      fs.mkdirSync(tileDir, { recursive: true });
    }

    const tilePath = path.join(tileDir, `${y}.${format}`);
    fs.writeFileSync(tilePath, tileData);
  }

  // Get a tile
  async getTile(
    year: number, 
    bbox: [number, number, number, number], 
    z: number, 
    x: number, 
    y: number, 
    format: 'png' | 'jpg' | 'webp' = 'png'
  ): Promise<Buffer | null> {
    const hash = this.generateMosaicHash(year, bbox);
    const tilePath = path.join(this.tilesDir, hash, z.toString(), x.toString(), `${y}.${format}`);
    
    if (!fs.existsSync(tilePath)) {
      return null;
    }

    try {
      return fs.readFileSync(tilePath);
    } catch (error) {
      console.error('Error reading tile:', error);
      return null;
    }
  }

  // Get tile URL for serving
  getTileUrl(year: number, bbox: [number, number, number, number], z: number, x: number, y: number, format: 'png' | 'jpg' | 'webp' = 'png'): string {
    const hash = this.generateMosaicHash(year, bbox);
    return `/api/mosaic-tiles/${hash}/${z}/${x}/${y}.${format}`;
  }

  // List all available mosaics
  async listMosaics(): Promise<LocalMosaicInfo[]> {
    const mosaics: LocalMosaicInfo[] = [];
    
    if (!fs.existsSync(this.tilesDir)) {
      return mosaics;
    }

    const mosaicDirs = fs.readdirSync(this.tilesDir);
    
    for (const dir of mosaicDirs) {
      const metadataPath = path.join(this.tilesDir, dir, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          mosaics.push(metadata);
        } catch (error) {
          console.error(`Error reading metadata for ${dir}:`, error);
        }
      }
    }

    return mosaics;
  }

  // Delete a mosaic
  async deleteMosaic(year: number, bbox: [number, number, number, number]): Promise<void> {
    const hash = this.generateMosaicHash(year, bbox);
    const mosaicDir = path.join(this.tilesDir, hash);
    
    if (fs.existsSync(mosaicDir)) {
      fs.rmSync(mosaicDir, { recursive: true, force: true });
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{
    totalMosaics: number;
    totalSize: number;
    totalTiles: number;
    mosaics: LocalMosaicInfo[];
  }> {
    const mosaics = await this.listMosaics();
    const totalSize = mosaics.reduce((sum, mosaic) => sum + mosaic.totalSize, 0);
    const totalTiles = mosaics.reduce((sum, mosaic) => sum + mosaic.tileCount, 0);

    return {
      totalMosaics: mosaics.length,
      totalSize,
      totalTiles,
      mosaics
    };
  }

  // Clean up old mosaics (older than specified days)
  async cleanupOldMosaics(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const mosaics = await this.listMosaics();
    let deletedCount = 0;

    for (const mosaic of mosaics) {
      const downloadDate = new Date(mosaic.downloadDate);
      if (downloadDate < cutoffDate) {
        await this.deleteMosaic(mosaic.year, mosaic.bbox);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const localMosaicStorage = new LocalMosaicStorage();
