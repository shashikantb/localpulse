
'use client';

import type { FC } from 'react';
import React, { useRef, useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import type { User } from '@/lib/db-types';
import { Button } from './ui/button';
import { Download, Phone, User as UserIcon, Shield, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { uploadGeneratedImage } from '@/app/actions';
import Image from 'next/image';

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
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, quality: 0.95 });
      const result = await uploadGeneratedImage(dataUrl, `bajrang-dal-id-card-${user.id}.png`);

      if (result.success && result.url) {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = `BajrangDal-ID-Card-${user.name}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
          title: 'Download Ready!',
          description: 'Your ID card image has been downloaded.',
        });
      } else {
        throw new Error(result.error || 'Failed to prepare image for download.');
      }
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
  }, [cardRef, user.id, user.name, toast]);

  return (
    <div className="space-y-4">
      <div 
        ref={cardRef} 
        className="relative p-4 border-2 border-orange-500 rounded-lg w-full max-w-sm mx-auto flex flex-col items-center space-y-3 text-black overflow-hidden"
        style={{
          backgroundImage: `url('/images/bajrang-dal-id-card-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#5D4037', // Dark brown for better readability
          textShadow: '0px 0px 5px rgba(255,255,255,0.7)', // Subtle white shadow
        }}
      >
        <div className="text-center">
          <h2 className="text-xl font-bold">बजरंग दल</h2>
          <p className="text-xs font-semibold">सेवा, सुरक्षा, संस्कार</p>
        </div>
        
        <Avatar className="h-24 w-24 border-4 border-orange-400 shadow-md">
          <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
          <AvatarFallback className="text-3xl bg-orange-100">
            {user.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className="text-center">
          <p className="text-2xl font-bold">{user.name}</p>
          <p className="text-lg font-semibold">{user.role}</p>
        </div>
        
        <div className="w-full text-center space-y-1 pt-2">
          <div className="flex items-center justify-center space-x-2">
            <UserIcon className="w-5 h-5" />
            <p className="font-semibold text-base">User ID: BD-{user.id}</p>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <Phone className="w-5 h-5" />
            <p className="font-semibold text-base">{user.mobilenumber}</p>
          </div>
        </div>

        <div className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-80">
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
