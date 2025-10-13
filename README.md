# Carbon Project Viewer

A Next.js application for visualizing carbon project polygons from KML files with timeseries satellite imagery for years 2017, 2021, and 2025.

## Features

- **KML File Support**: Upload and parse KML files containing project polygons
- **Interactive Map**: View polygons on an interactive Leaflet map with satellite imagery
- **Timeseries Viewer**: Switch between satellite imagery from 2017, 2021, and 2025
- **Responsive UI**: Clean, modern interface with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A KML file with your carbon project polygons

### Installation

1. Navigate to the project directory:
```bash
cd carbon-project-viewer
```

2. Install dependencies (if not already installed):
```bash
npm install
```

3. (Optional) Place your KML file in the `public` folder:
```bash
# Copy your KML file to public/carbon-project.kml
cp /path/to/your/file.kml public/carbon-project.kml
```

### Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Adding KML Files

There are two ways to load a KML file:

1. **Upload via UI**: Click the "Upload KML" button in the application header
2. **Pre-load**: Place a file named `carbon-project.kml` in the `public` folder

### Switching Between Years

Use the year selector buttons (2017, 2021, 2025) to view satellite imagery from different time periods.

### KML File Format

The application expects KML files with the following structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Project Area 1</name>
      <description>Description of the area</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              lng1,lat1,0 lng2,lat2,0 lng3,lat3,0 lng1,lat1,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
```

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Leaflet** - Interactive maps
- **React Leaflet** - React components for Leaflet
- **fast-xml-parser** - KML parsing

## Project Structure

```
carbon-project-viewer/
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   └── MapView.tsx       # Map component with Leaflet
├── lib/
│   └── kmlParser.ts      # KML parsing utilities
├── public/               # Static files (place KML here)
└── package.json
```

## Notes

- The satellite imagery is provided by Esri World Imagery
- The application uses client-side rendering for map components to avoid SSR issues with Leaflet
- Polygons are displayed with green color (#00ff00) for visibility

## License

MIT
