
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { requestBusinessVerification } from '@/app/users/[userId]/actions';
import { Loader2, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

export default function RequestVerificationButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRequest = () => {
    startTransition(async () => {
      const result = await requestBusinessVerification();
      if (result.success) {
        toast({
          title: 'Verification Requested!',
          description: 'Your request has been sent to the administrators for review.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Request Failed',
          description: result.error || 'Could not submit your request. Please try again.',
        });
      }
    });
  };

  return (
    <Card className="shadow-xl border-accent/30 bg-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
            <BadgeCheck className="mr-2 h-6 w-6 text-accent" />
            Get Verified
        </CardTitle>
        <CardDescription>
            Build trust with your customers by getting a verified badge on your profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
            <AlertTitle>How it Works</AlertTitle>
            <AlertDescription>
                Once you request verification, an admin will review your business details. This may involve a physical visit to your location.
            </AlertDescription>
        </Alert>
        <Button
          onClick={handleRequest}
          disabled={isPending}
          className="w-full mt-4"
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Request...</>
          ) : (
            'Request Verification Now'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
