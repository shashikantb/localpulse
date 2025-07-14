
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getPostsForMap } from '@/app/actions';
import type { Post } from '@/lib/db-types';
import { useToast } from '@/hooks/use-toast';
import { differenceInHours } from 'date-fns';
import { Button } from './ui/button';

// A simple debounce function to prevent excessive API calls
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return function(...args: Parameters<F>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

const getPulseClassName = (postDate: string): string => {
  const hours = differenceInHours(new Date(), new Date(postDate));
  if (hours < 1) return 'pulse-fast';
  if (hours < 6) return 'pulse-medium';
  return 'pulse-slow';
};

const HeatmapComponent = ({ posts }: { posts: Post[] }) => {
    const map = useMap();
    const heatmapLayerRef = useRef<L.HeatLayer | null>(null);

    useEffect(() => {
        // Dynamically import leaflet.heat only on the client side
        import('leaflet.heat').then(() => {
            if (!map) return;

            // Create or update heatmap layer
            if (heatmapLayerRef.current) {
                map.removeLayer(heatmapLayerRef.current);
            }

            if (posts.length > 0) {
                const points = posts.map(p => [p.latitude, p.longitude, 1] as L.HeatLatLngTuple);
                heatmapLayerRef.current = (L as any).heatLayer(points, { 
                    radius: 20, 
                    blur: 15,
                    max: 1.0
                }).addTo(map);
            }
        });
        
    }, [posts, map]);

    return null; // This component doesn't render anything itself
};


export default function MapViewer() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const mapRef = useRef<LeafletMap | null>(null);

  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const fetchPosts = useCallback(async (map: LeafletMap) => {
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

  // Set up map event listeners once the map instance is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Debounced fetch function
    const debouncedFetch = debounce(() => fetchPosts(map), 500);

    // Attach event listeners
    map.on('moveend', debouncedFetch);
    map.on('zoomend', debouncedFetch);
    
    // Initial fetch when map is ready
    fetchPosts(map);

    // Cleanup function
    return () => {
      map.off('moveend', debouncedFetch);
      map.off('zoomend', debouncedFetch);
    };
  }, [fetchPosts]); // Rerun if fetchPosts function reference changes

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
        whenCreated={instance => { mapRef.current = instance; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
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
