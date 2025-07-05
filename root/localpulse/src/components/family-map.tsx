
'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { FamilyMemberLocation, User } from '@/lib/db-types';
import L from 'leaflet';
import { formatDistanceToNowStrict } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { renderToStaticMarkup } from 'react-dom/server';

interface FamilyMapProps {
  locations: FamilyMemberLocation[];
  currentUser: User;
}

const createCustomIcon = (user: FamilyMemberLocation) => {
  const avatarMarkup = renderToStaticMarkup(
    <div className="relative">
      <Avatar className="h-10 w-10 border-2 border-primary bg-background p-0.5">
        <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-primary"></div>
    </div>
  );
  return new L.DivIcon({
    html: avatarMarkup,
    className: 'bg-transparent border-none',
    iconSize: [44, 48],
    iconAnchor: [22, 48], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -48], // Point from which the popup should open relative to the iconAnchor
  });
};

export default function FamilyMap({ locations, currentUser }: FamilyMapProps) {
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
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={createCustomIcon(loc)}>
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
