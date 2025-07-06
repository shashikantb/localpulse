
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserCheck, UserX, MailPlus, Loader2 } from 'lucide-react';
import type { PendingFamilyRequest } from '@/lib/db-types';
import { respondToFamilyRequest } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';

function RequestCard({ request, onRespond }: { request: PendingFamilyRequest; onRespond: (requestId: number) => void; }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleResponse = (response: 'approve' | 'reject') => {
    startTransition(async () => {
      const result = await respondToFamilyRequest(request.requester_id, response);
      if (result.success) {
        toast({ title: 'Success', description: `Request has been ${response}d.` });
        onRespond(request.id);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  return (
    <div className="p-3 border rounded-lg flex items-center justify-between gap-4 bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={request.requester_profile_picture_url || undefined} alt={request.requester_name} />
          <AvatarFallback>{request.requester_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="font-semibold text-foreground">{request.requester_name}</p>
      </div>
      <div className="flex gap-2">
        {isPending ? (
          <Button size="sm" disabled><Loader2 className="animate-spin" /></Button>
        ) : (
          <>
            <Button onClick={() => handleResponse('approve')} size="icon" variant="default" className="bg-green-600 hover:bg-green-700 h-8 w-8">
              <UserCheck className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleResponse('reject')} size="icon" variant="destructive" className="h-8 w-8">
              <UserX className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function FamilyRequestsList({ initialRequests }: { initialRequests: PendingFamilyRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);

  const handleRequestResponded = (respondedRequestId: number) => {
    setRequests(currentRequests => currentRequests.filter(req => req.id !== respondedRequestId));
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-xl border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MailPlus className="w-6 h-6 mr-2 text-primary" />
          Family Requests
        </CardTitle>
        <CardDescription>
          You have {requests.length} pending family request(s).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map(req => (
            <RequestCard key={req.id} request={req} onRespond={handleRequestResponded} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
