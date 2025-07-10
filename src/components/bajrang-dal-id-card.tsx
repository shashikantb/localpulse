
'use client';

import type { FC } from 'react';
import React, { useRef, useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import type { User } from '@/lib/db-types';
import { Button } from './ui/button';
import { Download, Phone, User as UserIcon, Shield, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface BajrangDalIdCardProps {
  user: User;
}

const BajrangDalIdCard: FC<BajrangDalIdCardProps> = ({ user }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const onDownload = useCallback(async () => {
    if (cardRef.current === null) {
      return;
    }
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `BajrangDal-ID-Card-${user.name.replace(/\s/g, '_')}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started!',
        description: 'Your ID card is being downloaded.',
      });

    } catch (err) {
      console.error('Failed to download ID card:', err);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Could not generate the ID card image. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [cardRef, user.name, toast]);

  return (
    <div className="space-y-4">
      <div 
        ref={cardRef} 
        className="relative w-full max-w-sm mx-auto h-[550px] overflow-hidden"
        style={{
          backgroundImage: `url('/images/bajrang-dal-id-card-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#5D4037',
        }}
      >
        {/* User Photo */}
        <div className="absolute top-16 left-6">
            <Avatar className="h-28 w-28 border-4 border-orange-400 shadow-lg">
                <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                <AvatarFallback className="text-4xl bg-orange-100">
                    {user.name.charAt(0)}
                </AvatarFallback>
            </Avatar>
        </div>

        {/* User Details */}
        <div className="absolute bottom-10 left-6 right-6">
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
