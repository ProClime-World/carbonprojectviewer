# Local Mosaic Download System

This system allows you to download and cache Sentinel-2 mosaics locally for fast loading in the carbon project viewer.

## Features

- **Local Storage**: Download and cache Sentinel-2 mosaics locally
- **Fast Loading**: Serve tiles from local storage instead of remote APIs
- **Tile Server**: Built-in tile server for serving cached mosaics
- **Progress Tracking**: Real-time download progress
- **Storage Management**: List, clean up, and manage local mosaics

## Installation

First, install the required dependencies:

```bash
npm install
```

## Usage

### Download Mosaics

Download mosaics for specific years and areas:

```bash
# Download for a specific year
npm run download-mosaics -- --year 2020 --bbox -74.2,40.5,-73.8,40.9

# Download for multiple years
npm run download-mosaics -- --years 2017-2023 --bbox -74.2,40.5,-73.8,40.9

# Download for NYC area (default bbox)
npm run download-mosaics -- --year 2020
```

### Manage Local Mosaics

```bash
# List all available mosaics
npm run download-mosaics -- --list

# Show storage statistics
npm run download-mosaics -- --stats

# Clean up old mosaics (older than 30 days)
npm run download-mosaics -- --cleanup

# Clean up mosaics older than 7 days
npm run download-mosaics -- --cleanup 7
```

## How It Works

### 1. Mosaic Discovery
- Queries STAC API for Sentinel-2 data
- Filters by year, bounding box, and cloud cover
- Selects best scenes based on cloud cover and sun angle

### 2. Local Processing
- Downloads Sentinel-2 visual assets
- Processes images with Sharp for optimization
- Generates tiles at multiple zoom levels
- Stores tiles in organized directory structure

### 3. Fast Serving
- Local tile server serves cached tiles
- Automatic fallback to STAC API if no local tiles
- Browser caching for optimal performance

## Directory Structure

```
public/data/mosaics/
├── tiles/
│   └── {mosaic-hash}/
│       ├── metadata.json
│       ├── 0/
│       │   └── 0/
│       │       └── 0.png
│       ├── 1/
│       │   ├── 0/
│       │   │   ├── 0.png
│       │   │   └── 1.png
│       │   └── 1/
│       │       ├── 0.png
│       │       └── 1.png
│       └── ...
```

## API Endpoints

### Tile Server
- `GET /api/mosaic-tiles/{hash}/{z}/{x}/{y}.{format}`
- Serves cached mosaic tiles
- Supports PNG, JPG, WebP formats

### Storage Management
- `GET /api/mosaics` - List all mosaics
- `GET /api/mosaics/stats` - Storage statistics
- `DELETE /api/mosaics/{hash}` - Delete specific mosaic

## Configuration

### Mosaic Settings
- **Max Cloud Cover**: 20% (configurable)
- **Tile Size**: 256x256 pixels
- **Max Zoom**: 10 levels
- **Image Format**: PNG (optimized)

### Storage Settings
- **Cache Duration**: 1 year for tiles
- **Auto Cleanup**: 30 days (configurable)
- **Compression**: JPEG quality 85%

## Performance Benefits

### Before (STAC API)
- ❌ Slow API responses (2-5 seconds)
- ❌ Rate limiting and quotas
- ❌ Network dependency
- ❌ No offline capability

### After (Local Storage)
- ✅ Instant tile loading (< 100ms)
- ✅ No rate limits
- ✅ Offline capability
- ✅ Reduced bandwidth usage

## Troubleshooting

### Common Issues

1. **"No mosaics found"**
   - Check if bounding box is valid
   - Verify year has Sentinel-2 data
   - Try different cloud cover threshold

2. **"Download failed"**
   - Check internet connection
   - Verify STAC API is accessible
   - Check available disk space

3. **"Tile not found"**
   - Ensure mosaic was downloaded completely
   - Check tile server is running
   - Verify tile coordinates are valid

### Debug Mode

Enable debug logging:

```bash
DEBUG=mosaic:* npm run download-mosaics -- --year 2020
```

## Storage Requirements

### Typical Sizes
- **Single Year (NYC area)**: ~50-100 MB
- **5 Years (NYC area)**: ~250-500 MB
- **Global Coverage**: ~1-5 GB per year

### Cleanup Recommendations
- Run cleanup weekly: `npm run download-mosaics -- --cleanup 7`
- Monitor disk usage: `npm run download-mosaics -- --stats`
- Remove unused mosaics manually

## Advanced Usage

### Custom Processing
You can extend the mosaic processing by modifying:
- `lib/mosaicDownloader.ts` - Download and processing logic
- `lib/localMosaicStorage.ts` - Storage management
- `scripts/download-mosaics.js` - CLI interface

### Integration
The system automatically integrates with:
- `components/SentinelMosaicLayer.tsx` - React component
- `lib/sentinelMosaic.ts` - STAC API client
- `app/api/mosaic-tiles/` - Tile server API

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all dependencies are installed
3. Ensure sufficient disk space
4. Check network connectivity to STAC API
