
'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { setAppSetting } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bot, Loader2 } from 'lucide-react';

const LIVE_SEEDING_KEY = 'live_seeding_enabled';

interface LiveSeedingToggleProps {
  initialValue: boolean;
}

export default function LiveSeedingToggle({ initialValue }: LiveSeedingToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      setIsEnabled(checked);
      const result = await setAppSetting(LIVE_SEEDING_KEY, String(checked));
      if (result.success) {
        toast({
          title: 'Setting Updated',
          description: `Live content seeding has been ${checked ? 'enabled' : 'disabled'}.`,
        });
      } else {
        setIsEnabled(!checked);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="space-y-4">
        <Alert>
            <Bot className="h-4 w-4" />
            <AlertTitle>How it Works</AlertTitle>
            <AlertDescription>
                <p>When enabled, the app will automatically generate local news content for a city the first time a user from that area opens the app. To prevent spam, new content for the same city will only be generated every few hours.</p>
                <p className="mt-2 text-xs text-muted-foreground">This feature requires a valid `SERPAPI_API_KEY` to function.</p>
            </AlertDescription>
        </Alert>
        <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <Label htmlFor="live-seeding-switch" className="text-base flex items-center">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Live Seeding Status
                </Label>
                <p className="text-sm text-muted-foreground">
                    Globally enable or disable this feature.
                </p>
            </div>
            <Switch
                id="live-seeding-switch"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isPending}
            />
        </div>
    </div>
  );
}
