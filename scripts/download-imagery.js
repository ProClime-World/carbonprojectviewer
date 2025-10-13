#!/usr/bin/env node

/**
 * Script to download satellite imagery mosaics for different years
 * This can be run to pre-download imagery and store it locally
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const YEARS = [2017, 2021, 2025];
const OUTPUT_DIR = path.join(__dirname, '../public/imagery');
const BBOX = [-180, -90, 180, 90]; // Global coverage

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Download imagery for a specific year
 */
async function downloadImageryForYear(year) {
  console.log(`🛰️ Downloading imagery for ${year}...`);
  
  try {
    // For now, we'll create placeholder files
    // In a real implementation, you would:
    // 1. Query STAC API for imagery
    // 2. Download and process tiles
    // 3. Create mosaics
    // 4. Store as GeoTIFF or tile sets
    
    const yearDir = path.join(OUTPUT_DIR, year.toString());
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    
    // Create a metadata file
    const metadata = {
      year,
      bbox: BBOX,
      downloaded: new Date().toISOString(),
      source: 'earth-search-stac',
      status: 'placeholder'
    };
    
    fs.writeFileSync(
      path.join(yearDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log(`✅ Created placeholder for ${year}`);
    
  } catch (error) {
    console.error(`❌ Error downloading imagery for ${year}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting imagery download process...');
  
  for (const year of YEARS) {
    await downloadImageryForYear(year);
  }
  
  console.log('✅ Imagery download process complete!');
  console.log(`📁 Imagery stored in: ${OUTPUT_DIR}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { downloadImageryForYear, YEARS, OUTPUT_DIR };
