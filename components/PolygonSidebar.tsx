'use client';

import { useMemo, useState } from 'react';
import { Polygon as PolygonType } from '@/lib/kmlParser';
import { computePolygonAreaSqKm, km2ToHectares, formatAreaHa } from '@/lib/geo';

interface PolygonSidebarProps {
  polygons: PolygonType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export default function PolygonSidebar({ polygons, selectedIndex, onSelect }: PolygonSidebarProps) {
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'area'>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const rows = useMemo(() => {
    const base = polygons.map((p, idx) => {
      const firstRing = p.coordinates[0] || [];
      const areaKm2 = computePolygonAreaSqKm(firstRing.map(c => ({ lat: c.lat, lng: c.lng })));
      const areaHa = km2ToHectares(areaKm2);
      return {
        id: idx + 1,
        originalIndex: idx,
        name: p.name || `Polygon ${idx + 1}`,
        areaHa,
      };
    });

    const sorted = [...base].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortBy === 'id') return (a.id - b.id) * dir;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      return (a.areaHa - b.areaHa) * dir;
    });

    return sorted;
  }, [polygons, sortBy, sortAsc]);

  const handleSort = (field: 'id' | 'name' | 'area') => {
    if (sortBy === field || (field === 'area' && sortBy === 'area')) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field === 'area' ? 'area' : field);
      setSortAsc(field !== 'name');
    }
  };

  return (
    <div className="w-80 h-full border-r bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="text-lg font-semibold text-gray-800">Project Areas</div>
        <div className="text-xs text-gray-500">{rows.length} polygons</div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left text-gray-600 select-none">
              <th className="px-3 py-2 w-16 cursor-pointer" onClick={() => handleSort('id')}>
                ID {sortBy === 'id' && (sortAsc ? '▲' : '▼')}
              </th>
              <th className="px-3 py-2 cursor-pointer" onClick={() => handleSort('name')}>
                Name {sortBy === 'name' && (sortAsc ? '▲' : '▼')}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('area')}>
                Area (ha) {sortBy === 'area' && (sortAsc ? '▲' : '▼')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onSelect(row.originalIndex)}
                className={
                  'cursor-pointer hover:bg-purple-50 ' +
                  (selectedIndex === row.originalIndex ? 'bg-purple-100' : '')
                }
              >
                <td className="px-3 py-2 text-gray-700">{row.id}</td>
                <td className="px-3 py-2">
                  <div className="text-gray-800 font-medium truncate">{row.name}</div>
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{formatAreaHa(row.areaHa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


