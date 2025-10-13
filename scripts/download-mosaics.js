#!/usr/bin/env node

// Script to download and process Sentinel-2 mosaics locally
// Usage: node scripts/download-mosaics.js [year] [west] [south] [east] [north]

const { MosaicDownloader, downloadMosaicsForYears } = require('../lib/mosaicDownloader');
const { localMosaicStorage } = require('../lib/localMosaicStorage');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node scripts/download-mosaics.js [options]

Options:
  --year <year>                    Download mosaic for specific year
  --years <start>-<end>            Download mosaics for year range (e.g., 2017-2023)
  --bbox <west>,<south>,<east>,<north>  Bounding box coordinates
  --list                           List existing mosaics
  --cleanup [days]                 Clean up mosaics older than specified days (default: 30)
  --stats                          Show storage statistics

Examples:
  node scripts/download-mosaics.js --year 2020 --bbox -74.2,40.5,-73.8,40.9
  node scripts/download-mosaics.js --years 2017-2023 --bbox -74.2,40.5,-73.8,40.9
  node scripts/download-mosaics.js --list
  node scripts/download-mosaics.js --stats
  node scripts/download-mosaics.js --cleanup 7
    `);
    process.exit(1);
  }

  try {
    // Parse command line arguments
    const options = parseArgs(args);
    
    if (options.list) {
      await listMosaics();
    } else if (options.stats) {
      await showStats();
    } else if (options.cleanup !== undefined) {
      await cleanupMosaics(options.cleanup);
    } else if (options.years || options.year) {
      await downloadMosaics(options);
    } else {
      console.error('No valid action specified. Use --help for usage information.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function parseArgs(args) {
  const options = {
    year: null,
    years: null,
    bbox: [-74.2, 40.5, -73.8, 40.9], // Default to NYC area
    list: false,
    stats: false,
    cleanup: undefined
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--year':
        options.year = parseInt(args[++i]);
        break;
      case '--years':
        const yearRange = args[++i];
        const [start, end] = yearRange.split('-').map(Number);
        options.years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        break;
      case '--bbox':
        const bboxStr = args[++i];
        options.bbox = bboxStr.split(',').map(Number);
        break;
      case '--list':
        options.list = true;
        break;
      case '--stats':
        options.stats = true;
        break;
      case '--cleanup':
        options.cleanup = parseInt(args[++i]) || 30;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

async function listMosaics() {
  console.log('📁 Available mosaics:');
  const mosaics = await localMosaicStorage.listMosaics();
  
  if (mosaics.length === 0) {
    console.log('  No mosaics found.');
    return;
  }

  mosaics.forEach(mosaic => {
    const sizeMB = (mosaic.totalSize / 1024 / 1024).toFixed(2);
    const date = new Date(mosaic.downloadDate).toLocaleDateString();
    console.log(`  📅 ${mosaic.year} | ${mosaic.bbox.join(', ')} | ${mosaic.tileCount} tiles | ${sizeMB} MB | ${date}`);
  });
}

async function showStats() {
  console.log('📊 Storage Statistics:');
  const stats = await localMosaicStorage.getStorageStats();
  
  const totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
  const totalSizeGB = (stats.totalSize / 1024 / 1024 / 1024).toFixed(2);
  
  console.log(`  Total Mosaics: ${stats.totalMosaics}`);
  console.log(`  Total Tiles: ${stats.totalTiles.toLocaleString()}`);
  console.log(`  Total Size: ${totalSizeMB} MB (${totalSizeGB} GB)`);
  
  if (stats.mosaics.length > 0) {
    console.log('\n📅 Mosaics by Year:');
    const byYear = stats.mosaics.reduce((acc, mosaic) => {
      acc[mosaic.year] = (acc[mosaic.year] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([year, count]) => {
        console.log(`  ${year}: ${count} mosaic(s)`);
      });
  }
}

async function cleanupMosaics(daysOld) {
  console.log(`🧹 Cleaning up mosaics older than ${daysOld} days...`);
  const deletedCount = await localMosaicStorage.cleanupOldMosaics(daysOld);
  console.log(`✅ Deleted ${deletedCount} old mosaics`);
}

async function downloadMosaics(options) {
  const years = options.years || [options.year];
  const bbox = options.bbox;
  
  console.log(`🛰️ Downloading mosaics for years: ${years.join(', ')}`);
  console.log(`📍 Bounding box: [${bbox.join(', ')}]`);
  
  const downloader = new MosaicDownloader((progress) => {
    const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
    process.stdout.write(`\r${progress.stage.toUpperCase()}: [${bar}] ${progress.progress}% - ${progress.message}`);
  });
  
  try {
    const results = await downloadMosaicsForYears(years, bbox, (year, progress) => {
      const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
      process.stdout.write(`\r${year}: [${bar}] ${progress.progress}% - ${progress.message}`);
    });
    
    console.log('\n✅ Download complete!');
    console.log(`📊 Downloaded ${results.length} mosaics:`);
    
    results.forEach(result => {
      const sizeMB = (result.totalSize / 1024 / 1024).toFixed(2);
      console.log(`  📅 ${result.year}: ${result.tileCount} tiles, ${sizeMB} MB`);
    });
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs, listMosaics, showStats, cleanupMosaics, downloadMosaics };
