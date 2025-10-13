'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PolygonSidebar from '@/components/PolygonSidebar';
import { parseKML, Polygon, ParseProgress } from '@/lib/kmlParser';

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p>Loading map...</p>
    </div>
  ),
});

// Dynamically import TimeSeriesPanel to avoid SSR issues with Leaflet
const TimeSeriesPanel = dynamic(() => import('@/components/TimeSeriesPanel'), {
  ssr: false,
});

const YEARS = [2017, 2021, 2025];

export default function Home() {
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2017);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [parseProgress, setParseProgress] = useState<ParseProgress | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [isChangingYear, setIsChangingYear] = useState(false);

  useEffect(() => {
    // Automatically load the KML file on startup
    loadKMLFile();
  }, []);

  const loadKMLFile = async () => {
    console.log('🔄 Starting to load KML file...');
    setIsLoading(true);
    setError('');
    setParseProgress(null);
    
    try {
      console.log('📡 Fetching /carbon-project.kml...');
      const response = await fetch('/carbon-project.kml');
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        console.log('📏 Content length:', contentLength);
        
        if (contentLength) {
          const sizeInMB = parseInt(contentLength) / (1024 * 1024);
          setFileSize(sizeInMB);
          console.log('📏 File size:', sizeInMB.toFixed(1), 'MB');
          
          if (sizeInMB > 10) {
            setError(`Warning: Large file detected (${sizeInMB.toFixed(1)}MB). This may take a while to process.`);
          }
        }
        
        console.log('📄 Reading response text...');
        const kmlContent = await response.text();
        console.log('📄 KML content length:', kmlContent.length);
        console.log('📄 First 200 chars:', kmlContent.substring(0, 200));
        
        console.log('🔍 Starting KML parsing...');
        const parsedPolygons = parseKML(kmlContent, (progress) => {
          console.log('📊 Parse progress:', progress);
          setParseProgress(progress);
        });
        
        console.log('✅ Parsing complete. Polygons found:', parsedPolygons.length);
        setPolygons(parsedPolygons);
        setParseProgress(null);
      } else {
        console.error('❌ Response not OK:', response.status, response.statusText);
        setError(`Failed to load KML file: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error loading KML file:', message);
      setError(`Failed to load KML file: ${message}`);
    } finally {
      setIsLoading(false);
      console.log('🏁 Loading complete');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setParseProgress(null);
    setFileSize(file.size / (1024 * 1024));
    
    try {
      const text = await file.text();
      const parsedPolygons = parseKML(text, (progress) => {
        setParseProgress(progress);
      });
      setPolygons(parsedPolygons);
      setParseProgress(null);
    } catch {
      setError('Failed to parse KML file');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-[#2d1b4e] text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">Carbon Project Viewer</h1>
        <p className="text-sm text-gray-300">Visualize carbon project polygons with satellite imagery</p>
      </header>

      {/* Controls */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* File Upload */}
          <div className="flex items-center gap-2">
            <label htmlFor="kml-upload" className="text-sm font-medium text-gray-700">
              Upload KML:
            </label>
            <input
              id="kml-upload"
              type="file"
              accept=".kml"
              onChange={handleFileUpload}
              className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#2d1b4e] hover:file:bg-purple-100"
            />
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Satellite Imagery Year:</label>
            <div className="flex gap-2">
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => {
                    console.log(`🔘 Year button clicked: ${year}`);
                    setIsChangingYear(true);
                    setSelectedYear(year);
                    // Reset the changing indicator after a short delay
                    setTimeout(() => setIsChangingYear(false), 1000);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedYear === year
                      ? 'bg-[#2d1b4e] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Polygon Count */}
          {polygons.length > 0 && (
            <div className="ml-auto text-sm text-gray-600">
              {polygons.length} polygon{polygons.length !== 1 ? 's' : ''} loaded
            </div>
          )}
        </div>

        {/* File Size Info */}
        {fileSize > 0 && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            File size: {fileSize.toFixed(1)}MB
          </div>
        )}

        {/* Progress Indicator */}
        {parseProgress && (
          <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-700">
                Processing: {parseProgress.currentPolygon}
              </span>
              <span className="text-sm text-purple-600">
                {parseProgress.processed} / {parseProgress.total}
              </span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2">
              <div
                className="bg-[#2d1b4e] h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(parseProgress.processed / parseProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Main content with sidebar, map, and right panel */}
      <div className="flex-1 relative flex min-h-0">
        {/* Left sidebar */}
        <PolygonSidebar
          polygons={polygons}
          selectedIndex={selectedPolygonIndex}
          onSelect={(idx) => setSelectedPolygonIndex(idx)}
        />

        {/* Map center */}
        <div className="flex-1 relative">
        {/* Year changing indicator */}
        {isChangingYear && (
          <div className="absolute top-4 right-4 z-20 bg-blue-500 text-white px-3 py-2 rounded-md shadow-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-sm">Changing to {selectedYear}...</span>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d1b4e] mx-auto mb-4"></div>
              <p className="text-gray-600">
                {parseProgress ? 'Processing KML file...' : 'Loading...'}
              </p>
              {fileSize > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  File size: {fileSize.toFixed(1)}MB - This may take a while
                </p>
              )}
            </div>
          </div>
        ) : polygons.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md p-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No KML file loaded</h3>
              <p className="text-gray-600">
                Upload a KML file or wait for the default file to load
              </p>
            </div>
          </div>
        ) : (
          <MapView polygons={
            selectedPolygonIndex !== null ? [polygons[selectedPolygonIndex]] : polygons
          } selectedYear={selectedYear} />
        )}
        </div>

        {/* Right time series panel */}
        <TimeSeriesPanel years={YEARS} selectedYear={selectedYear} polygon={
          selectedPolygonIndex !== null ? polygons[selectedPolygonIndex] : null
        } />
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 border-t p-3 text-center text-sm text-gray-600">
        <div className="flex justify-center items-center gap-4">
          <span>Satellite imagery for {selectedYear}</span>
          <span>•</span>
          <span>{polygons.length} project area{polygons.length !== 1 ? 's' : ''}</span>
          <span className="text-blue-600">• Sentinel-2 Mosaic</span>
        </div>
      </footer>
    </div>
  );
}
