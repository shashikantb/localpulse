
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sendLpPointsNotification } from './actions';
import { Loader2, Send } from 'lucide-react';
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

export default function SendNotificationButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSend = () => {
    startTransition(async () => {
      const result = await sendLpPointsNotification();
      if (result.success) {
        toast({
          title: 'Notifications Sent!',
          description: `Successfully sent ${result.successCount} notifications. ${result.failureCount} failed.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Failed',
          description: result.error,
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="w-full sm:w-auto" disabled={isPending}>
          <Send className="mr-2 h-4 w-4" />
          Send LP Points Notification
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will send a push notification to all users with registered devices. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, send to all users
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
