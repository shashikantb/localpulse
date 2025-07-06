
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendSosMessage } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SosButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSosClick = () => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const result = await sendSosMessage(latitude, longitude);

          if (result.success) {
            toast({
              title: 'SOS Sent!',
              description: result.message,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'SOS Failed',
              description: result.error,
            });
          }
          setIsLoading(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({
            variant: 'destructive',
            title: 'Location Error',
            description: 'Could not get your location. Please enable location services.',
          });
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        variant: 'destructive',
        title: 'Unsupported',
        description: 'Geolocation is not supported by your browser.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-6">
        <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button
            variant="destructive"
            size="icon"
            className="relative h-14 w-14 rounded-full shadow-lg animate-pulse"
            aria-label="SOS"
            disabled={isLoading}
            >
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
                <span className="font-bold text-xl">SOS</span>
            )}
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-6 w-6 text-destructive" />
                Confirm SOS Alert?
            </AlertDialogTitle>
            <AlertDialogDescription>
                This will immediately send an emergency alert with your current location to all family members with whom you are sharing your location. Use this only in a genuine emergency.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={handleSosClick}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Yes, Send SOS
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    