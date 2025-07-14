
import type { FC } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Map } from 'lucide-react';

const MapViewer = dynamic(() => import('@/components/map-viewer'), {
  ssr: false,
  loading: () => <MapPageSkeleton />,
});

const MapPageSkeleton = () => (
    <div className="flex-1 flex flex-col">
        <header className="p-4 border-b">
             <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
                <Map className="w-7 h-7 mr-3 text-primary"/>
                Live Map
            </h1>
        </header>
        <div className="flex-1 p-4">
             <Skeleton className="w-full h-full rounded-lg" />
        </div>
    </div>
);

const MapPage: FC = () => {
  return (
    <div className="flex flex-col h-[calc(100svh_-_var(--header-height,8.5rem))]">
      <header className="p-4 border-b bg-card">
         <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Map className="w-7 h-7 mr-3 text-primary"/>
            Live Local Map
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
            An interactive view of posts and activity in your area.
        </p>
      </header>
      <div className="flex-1 bg-muted/20">
         <MapViewer />
      </div>
    </div>
  );
};

export default MapPage;
