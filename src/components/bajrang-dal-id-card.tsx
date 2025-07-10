
'use client';

import type { FC } from 'react';
import React from 'react';
import { toBlob } from 'html-to-image';
import type { User } from '@/lib/db-types';
import { Button } from './ui/button';
import { Download, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getSignedUploadUrl } from '@/app/actions';

interface BajrangDalIdCardProps {
  user: User;
}

const BajrangDalIdCard: FC<BajrangDalIdCardProps> = ({ user }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const { toast } = useToast();

  const onDownload = React.useCallback(async () => {
    if (cardRef.current === null) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not find the card element to download.',
      });
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // 1. Generate the image as a Blob directly in the browser.
      const imageBlob = await toBlob(cardRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2.5,
      });

      if (!imageBlob) {
        throw new Error('Failed to generate ID card image blob.');
      }

      // 2. Get a pre-signed URL from our server to upload the file to GCS.
      // This is a small request and won't exceed the 1MB limit.
      const fileName = `id-card-${user.id}-${Date.now()}.png`;
      const signedUrlResult = await getSignedUploadUrl(fileName, imageBlob.type);

      if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
          throw new Error(signedUrlResult.error || 'Could not get an upload URL from the server.');
      }

      // 3. Upload the Blob directly to Google Cloud Storage from the browser.
      // This bypasses our server, avoiding any payload size limits.
      const uploadResponse = await fetch(signedUrlResult.uploadUrl, {
          method: 'PUT',
          body: imageBlob,
          headers: { 'Content-Type': imageBlob.type },
      });

      if (!uploadResponse.ok) {
          throw new Error('Failed to upload the generated image to storage.');
      }
      
      // 4. Open the public GCS URL. This is a standard HTTPS link.
      // The Android WebView's DownloadListener can handle this URL correctly.
      window.open(signedUrlResult.publicUrl, '_blank');
      
      toast({
        title: 'Download Started',
        description: 'Your ID card is being downloaded.',
      });

    } catch (err: any) {
      console.error('Failed to generate or download ID card image:', err);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: err.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [user.id, toast]);

  return (
    <div className="space-y-4">
      <div 
        ref={cardRef} 
        className="relative w-full max-w-sm h-[550px] overflow-hidden"
        style={{
          backgroundImage: `url('/images/bajrang-dal-id-card-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#5D4037', // Dark rich brown for text
        }}
      >
        {/* User Photo - Centered */}
        <div className="absolute inset-x-0 top-20 flex justify-center">
            <Avatar className="h-32 w-32 border-4 border-orange-400 shadow-lg">
                <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                <AvatarFallback className="text-4xl bg-orange-100">
                    {user.name.charAt(0)}
                </AvatarFallback>
            </Avatar>
        </div>

        {/* User Details */}
        <div className="absolute bottom-10 left-6 right-6" style={{ textShadow: '0px 1px 3px rgba(255,255,255,0.7)' }}>
            <div className="space-y-1 text-left">
                <p className="font-bold text-lg">ID: BD-{user.id}</p>
                <p className="font-bold text-lg">Name: {user.name}</p>
                <p className="font-bold text-lg">Mobile: {user.mobilenumber}</p>
                <p className="font-bold text-lg">Role: {user.role}</p>
            </div>
        </div>
      </div>
      
      <Button onClick={onDownload} disabled={isDownloading} className="w-full max-w-sm mx-auto bg-orange-600 hover:bg-orange-700">
        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Download ID Card
      </Button>
    </div>
  );
};

export default BajrangDalIdCard;
