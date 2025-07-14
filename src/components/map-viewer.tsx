
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getPostsForMap } from '@/app/actions';
import type { Post } from '@/lib/db-types';
import { useToast } from '@/hooks/use-toast';
import { differenceInHours } from 'date-fns';
import { Button } from './ui/button';

const getPulseClassName = (postDate: string): string => {
  const hours = differenceInHours(new Date(), new Date(postDate));
  if (hours < 1) return 'pulse-fast';
  if (hours < 6) return 'pulse-medium';
  return 'pulse-slow';
};

const HeatmapComponent = ({ posts }: { posts: Post[] }) => {
    const map = useMap();
    const heatmapLayerRef = useRef<any | null>(null);

    useEffect(() => {
        // Dynamically import leaflet.heat only on the client side
        import('leaflet.heat').then((heat) => {
            if (!map) return;
            const Lheat = (heat as any).default || heat;

            // Create or update heatmap layer
            if (heatmapLayerRef.current) {
                map.removeLayer(heatmapLayerRef.current);
            }

            if (posts.length > 0) {
                const points = posts.map(p => [p.latitude, p.longitude, 1] as L.HeatLatLngTuple);
                heatmapLayerRef.current = Lheat(points, { 
                    radius: 20, 
                    blur: 15,
                    max: 1.0
                }).addTo(map);
            }
        }).catch(err => console.error("Failed to load leaflet.heat", err));
        
    }, [posts, map]);

    return null; // This component doesn't render anything itself
};


const MapEvents = ({ onMapChange }: { onMapChange: (map: LeafletMap) => void }) => {
    const map = useMapEvents({
        moveend: () => onMapChange(map),
        zoomend: () => onMapChange(map),
    });
    
    // Use an effect to trigger the initial fetch once the map is ready.
    useEffect(() => {
        onMapChange(map);
    }, [map, onMapChange]);
    
    return null;
};

// Simplified debounce function
function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


export default function MapViewer() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fix for broken Leaflet icons in Next.js
  useEffect(() => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
  }, []);

  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const addPostsIncrementally = useCallback((postsToAdd: Post[]) => {
      setPosts([]); // Clear old posts from state immediately
      let i = 0;
      const interval = setInterval(() => {
          if (i < postsToAdd.length) {
              setPosts(current => [...current, postsToAdd[i]]);
              i++;
          } else {
              clearInterval(interval);
          }
      }, 50); // Add one marker every 50ms
      return () => clearInterval(interval);
  }, []);

  const fetchAndSetPosts = useCallback(async (map: LeafletMap) => {
    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const mapBounds = {
        ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      };
      const fetchedPosts = await getPostsForMap(mapBounds);
      addPostsIncrementally(fetchedPosts);
    } catch (err) {
      console.error("Failed to fetch map data", err);
      toast({
        variant: "destructive",
        title: "Could not load data",
        description: "There was an error fetching posts for the map.",
      });
    } finally {
      // This is crucial: ensure loading is always turned off.
      setIsLoading(false);
    }
  }, [toast, addPostsIncrementally]);
  
  // Set up initial geolocation
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error(err);
        setError('Could not get your location. Please enable location services and refresh.');
        setPosition([20.5937, 78.9629]); // Default to central India
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const debouncedFetch = useCallback(debounce(fetchAndSetPosts, 500), [fetchAndSetPosts]);

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
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents onMapChange={debouncedFetch} />

        <HeatmapComponent posts={posts} />
        
        <Marker position={position} icon={userIcon}>
          <Popup>You are here.</Popup>
        </Marker>
        
        {posts.map(post => {
            const pulseClassName = getPulseClassName(post.createdat);
            const postIcon = new L.DivIcon({
              html: `<div class="pulsing-dot ${pulseClassName}"></div>`,
              className: 'bg-transparent border-0',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

            return (
                <Marker key={post.id} position={[post.latitude, post.longitude]} icon={postIcon}>
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
            );
        })}
      </MapContainer>
    </div>
  );
}
