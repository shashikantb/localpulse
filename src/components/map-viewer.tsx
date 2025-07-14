
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import Link from 'next/link';
import { getPostsForMap } from '@/app/actions';
import type { Post } from '@/lib/db-types';
import { useToast } from '@/hooks/use-toast';

// Component to handle map centering and data fetching on move/zoom
function MapEvents({ onBoundsChange }: { onBoundsChange: (map: LeafletMap) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map),
    zoomend: () => onBoundsChange(map),
  });
  return null;
}

export default function MapViewer() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Custom icon for user's location
  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  const fetchMapData = useCallback(async (map: LeafletMap) => {
    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const mapBounds = {
        ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      };
      const fetchedPosts = await getPostsForMap(mapBounds);
      setPosts(fetchedPosts);
    } catch (err) {
      console.error("Failed to fetch map data", err);
      toast({
        variant: "destructive",
        title: "Could not load data",
        description: "There was an error fetching posts for the map.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error(err);
        setError('Could not get your location. Please enable location services and refresh.');
        setPosition([20.5937, 78.9629]); // Default to center of India
      },
      {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
      }
    );
  }, []);

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  if (!position) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Finding your location to load map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
         <div className="absolute top-4 right-4 z-[1000] bg-background/80 p-2 rounded-md shadow-lg flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm font-medium">Loading Pulses...</span>
         </div>
      )}
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="h-full w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onBoundsChange={fetchMapData} />
        
        {/* User's Location Marker */}
        <Marker position={position} icon={userIcon}>
          <Popup>You are here.</Popup>
        </Marker>
        
        {/* Posts Markers */}
        <MarkerClusterGroup chunkedLoading>
          {posts.map(post => (
            <Marker key={post.id} position={[post.latitude, post.longitude]}>
              <Popup>
                <div className="w-48">
                    <p className="font-semibold text-base mb-1 truncate">{post.content || "Media Post"}</p>
                    <p className="text-xs text-muted-foreground mb-2">By: {post.authorname || 'Anonymous'}</p>
                    <Button asChild size="sm" className="w-full">
                        <Link href={`/posts/${post.id}`}>View Pulse</Link>
                    </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
