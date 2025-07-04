
'use client';

import type { FC } from 'react';
import React, { useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import type { User } from '@/lib/db-types';
import { Button } from './ui/button';
import { Download, Phone, User as UserIcon, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useToast } from '@/hooks/use-toast';

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

  const onDownload = useCallback(() => {
    if (cardRef.current === null) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not capture ID card.' });
      return;
    }
    toPng(cardRef.current, { cacheBust: true, backgroundColor: '#ffffff' })
      .then((dataUrl) => {
        saveAs(dataUrl, `bajrang-dal-id-card-${user.id}.png`);
        toast({ title: 'Success', description: 'ID Card downloaded.' });
      })
      .catch((err) => {
        console.error('oops, something went wrong!', err);
        toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate ID card image.' });
      });
  }, [cardRef, user.id, toast]);

  return (
    <div className="space-y-4">
      <div ref={cardRef} className="p-4 border-2 border-orange-500 bg-orange-50 rounded-lg w-full max-w-sm mx-auto flex flex-col items-center space-y-4">
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
      <Button onClick={onDownload} className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Download ID Card
      </Button>
    </div>
  );
};

export default BajrangDalIdCard;
