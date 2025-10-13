import { XMLParser } from 'fast-xml-parser';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Polygon {
  name: string;
  description?: string;
  coordinates: Coordinate[][];
}

export interface ParseProgress {
  processed: number;
  total: number;
  currentPolygon: string;
}

export function parseKML(kmlContent: string, onProgress?: (progress: ParseProgress) => void): Polygon[] {
  console.log('🔍 Starting KML parsing...');
  console.log('📄 KML content length:', kmlContent.length);
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    processEntities: true,
    htmlEntities: true,
  });

  console.log('📊 Parsing XML...');
  const result = parser.parse(kmlContent);
  console.log('📊 XML parsed, result structure:', Object.keys(result));
  
  const polygons: Polygon[] = [];

  // Navigate the KML structure
  const document = result.kml?.Document || result.kml;
  console.log('📊 Document structure:', document ? Object.keys(document) : 'No document found');
  
  // Look for placemarks in folders or directly in document
  let placemarks = [];
  
  // Check if there are folders first
  if (document.Folder) {
    const folders = Array.isArray(document.Folder) ? document.Folder : [document.Folder];
    console.log('📊 Found folders:', folders.length);
    
    for (const folder of folders) {
      if (folder.Placemark) {
        const folderPlacemarks = Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark];
        placemarks = placemarks.concat(folderPlacemarks);
        console.log('📊 Found placemarks in folder:', folderPlacemarks.length);
      }
    }
  }
  
  // Also check for direct placemarks in document
  if (document.Placemark) {
    const directPlacemarks = Array.isArray(document.Placemark) ? document.Placemark : [document.Placemark];
    placemarks = placemarks.concat(directPlacemarks);
    console.log('📊 Found direct placemarks:', directPlacemarks.length);
  }

  console.log('📊 Total placemarks found:', placemarks.length);
  const totalPlacemarks = placemarks.length;
  let processed = 0;

  for (const placemark of placemarks) {
    if (!placemark) {
      processed++;
      continue;
    }

    // Debug: Log first few placemarks to understand structure
    if (processed < 3) {
      console.log('📊 Placemark structure:', Object.keys(placemark));
      console.log('📊 Placemark name:', placemark.name);
      console.log('📊 Has Polygon:', !!placemark.Polygon);
      console.log('📊 Has MultiGeometry:', !!placemark.MultiGeometry);
    }

    // Report progress
    if (onProgress) {
      onProgress({
        processed,
        total: totalPlacemarks,
        currentPolygon: placemark.name || 'Unnamed Polygon',
      });
    }

    const polygon = placemark.Polygon || placemark.MultiGeometry?.Polygon;
    if (!polygon) {
      processed++;
      continue;
    }

    const polygonArray = Array.isArray(polygon) ? polygon : [polygon];

    for (const poly of polygonArray) {
      const outerBoundary = poly.outerBoundaryIs || poly.OuterBoundaryIs;
      if (!outerBoundary?.LinearRing?.coordinates) continue;

      const coordString = outerBoundary.LinearRing.coordinates;
      const coordinates = parseCoordinates(coordString);

      if (coordinates.length > 0) {
        polygons.push({
          name: placemark.name || 'Unnamed Polygon',
          description: placemark.description,
          coordinates: [coordinates],
        });
      }
    }

    processed++;

    // Log progress every 1000 placemarks
    if (processed % 1000 === 0) {
      console.log(`📊 Processed ${processed}/${totalPlacemarks} placemarks, found ${polygons.length} polygons`);
    }
  }

  console.log('✅ KML parsing complete. Total polygons found:', polygons.length);
  return polygons;
}

function parseCoordinates(coordString: string): Coordinate[] {
  const coords: Coordinate[] = [];
  const points = coordString.trim().split(/\s+/);

  for (const point of points) {
    const [lng, lat, alt] = point.split(',').map(Number);
    if (!isNaN(lng) && !isNaN(lat)) {
      coords.push({ lat, lng });
    }
  }

  return coords;
}
