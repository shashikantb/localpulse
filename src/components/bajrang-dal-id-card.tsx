
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

  const vhpLogoDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAOVBMVEXm5+bm5+bl5ufm5+bm5+bm5+bm5+bm5+bm5+bl5ubm5+bm5+bl5ubm5+bm5+bm5+bm5+bm5+Y7Vv0+AAABb0lEQVR4nO3dy27CMBCAYQUV93DBIf7/b924Ea44idC0UunJ5JvQlIe2nZ11TVVVVVVVVVVVVfUnwH04rP66C7s8R+QhP8+xXhO8G/d95tC3F+x2gvvuA7zP8Xj+7/w6D/zX/d/3+b8XfB/n8/y/n8A/P4tV/n8G/u/5f5/h/wX43wP8v8fw/+H/P8/zfwP+H/4/A/+H/6/J/wn8v/x/o/wP4n8O/j/J/hv8//L/b8h/wv//+f8/+a/4P8P/9/n/F/mv+H+3/y/yX/T/cf4/y/89/3/8//v8n+3/3/r/5/4P/D/s/w/8v+v/k/3/6/5f5f/u/r/V/iv+X/y/y/3f/H/X/5/4P/T/f/6/7f/P/Z/8f7v/P/b/y/7f/H/7/9f5/+b/j/7/6v5f7v+v9X+b/a/0P/7/L/R/mfw/8P+v8r/wP5v8f/j/J/w/9v8/wT+f/X/R/kf8H/g/7f5Pwb/5/3/Jv+P+f/h/x/k/zP8v8n/Qf6P8f8n/w/7P8//+fx/5f/V/d/n/wD/GfzP8P+b/R/u/x3/n+f/HP5/+P8T/M/1P6uqqqqqqqqqqmpLfgE2z0w90pZ/EgAAAABJRU5ErkJggg==";
  const hanumanLogoDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAMAAACahl6sAAAAZlBMVEX////MAADKAADsAADKAADKAADKAADKAADKAADJAADKAADKAADKAADJAADMAADmAAD3AADbAADJAADKAADJAADJAADKAADJAADJAADJAADKAADKAADJAADKAAD4AAD+AAD6AAD8AADxAADUAADiAACx7eSgAAAAGXRSTlP+AQcIAwYEBAj+A/z8/v4EAv39/v48eSuwAAADh0lEQVR42u3c23qqMBSG4TCBFBQUZcb7v+Xp9Gg7dthsGpfj/H7eaUv70649hLsuQRAEQRAEQRAEQRAEQRAEQRAEQRAEQRAEQRAEQRCEOwP3Z+h9YwbbA/sB3vWf1j9G+3sZ/gPf97+2wY/sz/B3P5h//eP+B5/rP7M//Mfz/9v+3/l/6f/3/M8+wP5b/gOAfz/+0P+t/uP5z/mfz/+/wv/pD/gP8B8e+f/853/u/z/+/xP/D/u/3f/X+3/F/3v+D/B/iP/n+f/i/x/6/w/9/zL//+b/P/q//f9e/s//X+b/L//P9/+v/Z/q/zn/s/z/yv+f+T/Z//P6/+L/6P93+b/j//n+//P+H/w/7f5//n/t/yP/h/6//H+T/r//n9//Yf8P+3/n/5v9v/V/7f4f/H/D/x/5f+T/b/7/+P+D/z/7P9/+X/S/8v/P/h/8/+n+b/q/o/+//v8B/w/6P9n/Uf7/+H/m/8/+T/L/lP8v83+Y/2/z/zL/r/N/mv+H+f89/7+H/q/+H+T/Uf6/zP/T/G/x/x7/V/+f5/+X/L/J/zH+//b/p/z/1v8p/+/p//X8v8H/R/s/+X+D/7/0//+E/5/5P8H/i/x/vP8v9n/U/wH+j/X/t/w/1f+f/z/E//f6f4H/n/4f5H/m/wn+//h/+f+1/G/z/zH//+r/yv/T/o/x/3f+P/1/lf+//X+B/xv93/f//35f+L/3f+X/j/m/+P+P/z/3/x/8f+f/D/4/9P/h/5/4P/D/p/1v9f9/+E/5v8H+L/L/P/tP8H/H/g/wL/Z/m/+f9l/n/F/gv+//p/xf/z/a/x/y3/w/xf8v80/yv9X+j/ov8n+H/y/yf/Z/2/0//l/lf6v+D/y/6f8H/s/5f6/+S/wv9H+n/5v8//9+o/4P9n/T/Xv7v6P9r/b/y/7P+H+7/Y/2/x/+L/T/X/4f6v6j//0R+B/6P7T9u/c//8/yf4H/F/v/V/t/qf8//j/wP/R/yP5f6f+8/F/+P/T/zP//Ef/P/n/y/9P/n/xf6v9R/m/yv9P/m/x/+b/N/2/1/wT/f/P/6f9X/T/Z/yf8n+H/Qf4P9r/u/6/4f+f/v/r/S//f8v8E/n/zf4D/y/xP9v+U//f8z/9A/63+3/D/mv+//n+x/5v8D/l/w/+L/D/l/xv9n/B/0f/n+X/Vv8X/p/3f8L/R/8P/R/if5P/b//P83/X/3n/L/5f7f/B/+f4/9L/p/3f8n+x/+/6n+z/p/j/wf9/+r/6/wf//+v/aP83/d/j/2v+3+//xf4f/h/g//v8P+b/N/n/2P/f8j/D/m/z//T/H/Z//f8f+v+V/4v+f5v/5/+b/P/6P/l/wv+7/P/Yf9v8j/N/1/+b+L/7/+n/T/d/lf5f/r/V/0f//9f/p/y/0f8/+b/Qf5/v/6v+H+N/+/2P8r/x/7f//+n/Z/n/7v9H/h/z/wz/A/6/8H+g/8/+7/H//f4//P+T/3+I/wv+T/H/lf9H/n/2f6v/x/6/6v9f/F/1f+v+v/d/h+I/7/+b/F/2f9V/m/xv/D/ov8H+T8EQRAEQRAEQRAEQRAEQRAEQRAEQRAEQRAEQRAE4R/hBwH/XG0p7X5ZAAAAAElFTkSuQmCC";
  
  return (
    <div className="space-y-4">
      <div 
        ref={cardRef} 
        className="relative p-4 border-2 border-orange-500 bg-orange-50 rounded-lg w-full max-w-sm mx-auto flex flex-col items-center space-y-3 text-black overflow-hidden"
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
          <div className="flex justify-between items-center w-full px-2">
            <div className="w-12 h-12 relative">
                <Image src={hanumanLogoDataUri} alt="Bajrang Dal Logo" layout="fill" objectFit="contain" data-ai-hint="logo" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-bold text-orange-800 -mb-1" style={{fontFamily: "'Teko', sans-serif"}}>बजरंग दल</h2>
                <p className="text-xs font-semibold text-orange-600">IDENTITY CARD</p>
            </div>
            <div className="w-12 h-12"><!-- Spacer --></div>
          </div>
          
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
