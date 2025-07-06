
'use client';

import type { FC } from 'react';
import { useTransition, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { toggleLocationSharing } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface LocationSharingToggleProps {
  targetUserId: number;
  initialIsSharing: boolean;
}

const LocationSharingToggle: FC<LocationSharingToggleProps> = ({ targetUserId, initialIsSharing }) => {
  const [isSharing, setIsSharing] = useState(initialIsSharing);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      // Optimistic update
      setIsSharing(checked);
      
      const result = await toggleLocationSharing(targetUserId, checked);

      if (!result.success) {
        // Revert on error
        setIsSharing(!checked);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Could not update location sharing preference.',
        });
      } else {
         toast({
          title: 'Preference Saved',
          description: `Location sharing has been ${checked ? 'enabled' : 'disabled'}.`,
        });
      }
    });
  };

  return (
    <Switch
      checked={isSharing}
      onCheckedChange={handleToggle}
      disabled={isPending}
      aria-label="Toggle location sharing"
    />
  );
};

export default LocationSharingToggle;
