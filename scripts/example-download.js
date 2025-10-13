#!/usr/bin/env node

// Example script showing how to download mosaics programmatically
const { MosaicDownloader } = require('../lib/mosaicDownloader');
const { localMosaicStorage } = require('../lib/localMosaicStorage');

async function exampleDownload() {
  console.log('🚀 Example: Downloading Sentinel-2 mosaics');
  
  // Define the area of interest (NYC area)
  const bbox = [-74.2, 40.5, -73.8, 40.9];
  const year = 2020;
  
  console.log(`📍 Area: [${bbox.join(', ')}]`);
  console.log(`📅 Year: ${year}`);
  
  // Create downloader with progress callback
  const downloader = new MosaicDownloader((progress) => {
    const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
    process.stdout.write(`\r${progress.stage.toUpperCase()}: [${bar}] ${progress.progress}% - ${progress.message}`);
  });
  
  try {
    console.log('\n🛰️ Starting download...');
    
    // Download the mosaic
    const result = await downloader.downloadMosaic(year, bbox);
    
    console.log('\n✅ Download complete!');
    console.log(`📊 Mosaic Info:`);
    console.log(`  📅 Year: ${result.year}`);
    console.log(`  📍 BBox: [${result.bbox.join(', ')}]`);
    console.log(`  🧩 Tiles: ${result.tileCount}`);
    console.log(`  💾 Size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  🛰️ Scenes: ${result.scenes.length}`);
    console.log(`  📅 Downloaded: ${new Date(result.downloadDate).toLocaleString()}`);
    
    // Show storage stats
    console.log('\n📊 Storage Statistics:');
    const stats = await localMosaicStorage.getStorageStats();
    console.log(`  Total Mosaics: ${stats.totalMosaics}`);
    console.log(`  Total Tiles: ${stats.totalTiles.toLocaleString()}`);
    console.log(`  Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Show how to use the tiles
    console.log('\n🔗 Tile URLs:');
    console.log(`  Base URL: ${localMosaicStorage.getTileUrl(year, bbox, 0, 0, 0)}`);
    console.log(`  Zoom 1: ${localMosaicStorage.getTileUrl(year, bbox, 1, 0, 0)}`);
    console.log(`  Zoom 2: ${localMosaicStorage.getTileUrl(year, bbox, 2, 0, 0)}`);
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  exampleDownload();
}

module.exports = { exampleDownload };
