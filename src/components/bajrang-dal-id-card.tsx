
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
        className="relative p-4 border rounded-lg w-full max-w-sm mx-auto flex flex-col h-[550px] text-black overflow-hidden"
        style={{
          backgroundImage: `url('/images/bajrang-dal-id-card-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#5D4037',
        }}
      >
        {/* Header Section */}
        <div className="text-center pt-8 h-[140px] flex-shrink-0">
            {/* The header is now part of the background image */}
        </div>

        {/* Main Content Section */}
        <div className="flex flex-col items-center justify-start flex-grow space-y-3 pt-4">
          <Avatar className="h-32 w-32 border-4 border-orange-400 shadow-lg -mt-16">
            <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
            <AvatarFallback className="text-4xl bg-orange-100">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center">
            <p className="text-3xl font-bold" style={{textShadow: '0px 1px 2px rgba(255,255,255,0.7)'}}>{user.name}</p>
            <p className="text-xl font-semibold opacity-90">{user.role}</p>
          </div>
          
          <div className="w-full text-center space-y-2 pt-4">
            <div className="flex items-center justify-center space-x-2">
              <UserIcon className="w-5 h-5" />
              <p className="font-semibold text-lg">User ID: BD-{user.id}</p>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Phone className="w-5 h-5" />
              <p className="font-semibold text-lg">{user.mobilenumber}</p>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="flex items-center justify-end space-x-1 opacity-90 pb-2 flex-shrink-0">
          <Shield className="w-5 h-5 text-orange-600"/>
          <p className="text-xs font-bold">Gorakshak</p>
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
