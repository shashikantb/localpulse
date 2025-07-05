
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { User, FamilyMemberLocation } from '@/lib/db-types';
import L from 'leaflet';
import { formatDistanceToNowStrict } from 'date-fns';

interface FamilyMapProps {
  locations: FamilyMemberLocation[];
  currentUser: User;
}

export default function FamilyMap({ locations }: FamilyMapProps) {
  // Calculate the center of the map
  const getMapCenter = (): [number, number] => {
    if (locations.length === 0) {
      return [20.5937, 78.9629]; // Default to center of India
    }
    const { totalLat, totalLon } = locations.reduce(
      (acc, loc) => ({
        totalLat: acc.totalLat + loc.latitude,
        totalLon: acc.totalLon + loc.longitude,
      }),
      { totalLat: 0, totalLon: 0 }
    );
    return [totalLat / locations.length, totalLon / locations.length];
  };
  
  const getBounds = () => {
    if (locations.length === 0) return undefined;
    const bounds = new L.LatLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
    return bounds.pad(0.2); // Add 20% padding
  };

  return (
    <MapContainer
      center={getMapCenter()}
      bounds={getBounds()}
      scrollWheelZoom={true}
      className="h-[60vh] w-full rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
          <Popup>
            <div className="text-center font-semibold">{loc.name}</div>
            <div className="text-xs text-muted-foreground">
              Last seen: {formatDistanceToNowStrict(new Date(loc.last_updated), { addSuffix: true })}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
