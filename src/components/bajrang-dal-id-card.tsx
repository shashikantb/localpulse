
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
import UpdateMobileForm from './update-mobile-form';

interface BajrangDalIdCardProps {
  user: User;
}

const BajrangDalSymbol: FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" className="w-full h-auto">
    <rect width="200" height="120" fill="#FF9933"/>
    <text x="100" y="70" fontFamily="'Teko', sans-serif" fontSize="30" fill="white" textAnchor="middle" fontWeight="bold">बजरंग दल</text>
  </svg>
);

const BajrangDalIdCard: FC<BajrangDalIdCardProps> = ({ user }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const onDownload = useCallback(async () => {
    if (cardRef.current === null) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not capture ID card element.' });
      return;
    }
    
    setIsDownloading(true);

    try {
      // 1. Generate image data URL on the client
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 });
      
      // 2. Upload the generated image to the server, which uploads to GCS
      const result = await uploadGeneratedImage(dataUrl, `bajrang-dal-id-card-${user.id}.png`);

      if (!result.success || !result.url) {
        throw new Error(result.error || 'Failed to get download link from server.');
      }
      
      // 3. Trigger download using the real URL from GCS
      const link = document.createElement('a');
      link.href = result.url;
      // The 'download' attribute suggests a filename to the browser
      link.download = `bajrang-dal-id-card-${user.id}.png`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Success', description: 'ID Card download started.' });

    } catch (err: any) {
      console.error('Download failed:', err);
      toast({ variant: 'destructive', title: 'Download Failed', description: err.message || 'Could not generate or download the ID card.' });
    } finally {
      setIsDownloading(false);
    }
  }, [cardRef, user.id, toast]);

  const vhpLogoDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAOVBMVEXm5+bm5+bl5ufm5+bm5+bm5+bm5+bm5+bm5+bm5+bl5ubm5+bm5+bl5ubm5+bm5+bm5+bm5+bm5+bm5+Y7Vv0+AAABb0lEQVR4nO3dy27CMBCAYQUV93DBIf7/b924Ea44idC0UunJ5JvQlIe2nZ11TVVVVVVVVVVVVfUnwH04rP66C7s8R+QhP8+xXhO8G/d95tC3F+x2gvvuA7zP8Xj+7/w6D/zX/d/3+b8XfB/n8/y/n8A/P4tV/n8G/u/5f5/h/wX43wP8v8fw/+H/P8/zfwP+H/4/A/+H/6/J/wn8v/x/o/wP4n8O/j/J/hv8//L/b8h/wv//+f8/+a/4P8P/9/n/F/mv+H+3/y/yX/T/cf4/y/89/3/8//v8n+3/3/r/5/4P/D/s/w/8v+v/k/3/6/5f5f/u/r/V/iv+X/y/y/3f/H/X/5/4P/T/f/6/7f/P/Z/8f7v/P/b/y/7f/H/7/9f5/+b/j/7/6v5f7v+v9X+b/a/0P/7/L/R/mfw/8P+v8r/wP5v8f/j/J/w/9v8/wT+f/X/R/kf8H/g/7f5Pwb/5/3/Jv+P+f/h/x/k/zP8v8n/Qf6P8f8n/w/7P8//+fx/5f/V/d/n/wD/GfzP8P+b/R/u/x3/n+f/HP5/+P8T/M/1P6uqqqqqqqqqqmpLfgE2z0w90pZ/EgAAAABJRU5ErkJggg==";

  return (
    <div className="space-y-4">
      <div 
        ref={cardRef} 
        className="relative p-4 border-2 border-orange-500 bg-orange-50 rounded-lg w-full max-w-sm mx-auto flex flex-col items-center space-y-4 text-black overflow-hidden"
      >
        <div 
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundImage: `url(${vhpLogoDataUri})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '80%',
                opacity: 0.08,
                width: '100%',
                height: '100%',
                zIndex: 0,
            }}
        ></div>

        <div className="relative z-10 flex flex-col items-center w-full space-y-4">
          <div className="w-24 h-16">
            <BajrangDalSymbol />
          </div>
          <h2 className="text-xl font-bold text-orange-800 tracking-wider">IDENTITY CARD</h2>
          <Avatar className="h-28 w-28 border-4 border-orange-400">
            <AvatarImage src={user.profilepictureurl ?? undefined} alt={user.name} />
            <AvatarFallback className="text-4xl">{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{user.name}</p>
            <p className="text-sm font-semibold text-orange-600">{user.role}</p>
          </div>
          <div className="w-full pt-4 border-t border-orange-200 text-left space-y-2">
              <p className="flex items-center text-sm"><UserIcon className="w-4 h-4 mr-2 text-orange-700"/> <span className="font-semibold mr-2">ID:</span> LP-{user.id}</p>
              <p className="flex items-center text-sm"><Phone className="w-4 h-4 mr-2 text-orange-700"/> <span className="font-semibold mr-2">Mobile:</span> {user.mobilenumber}</p>
              <p className="flex items-center text-sm"><Shield className="w-4 h-4 mr-2 text-orange-700"/> <span className="font-semibold mr-2">Status:</span> {user.status}</p>
          </div>
        </div>
      </div>
      <Button onClick={onDownload} className="w-full" disabled={isDownloading}>
        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {isDownloading ? 'Generating...' : 'Download ID Card'}
      </Button>
    </div>
  );
};

export default BajrangDalIdCard;
