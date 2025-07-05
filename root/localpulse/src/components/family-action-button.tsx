
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserCheck, UserX, Clock } from 'lucide-react';
import type { FamilyRelationshipStatus } from '@/lib/db-types';
import { sendFamilyRequest, respondToFamilyRequest, cancelFamilyRequest } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface FamilyActionButtonProps {
  initialStatus: FamilyRelationshipStatus;
  targetUserId: number;
}

export default function FamilyActionButton({ initialStatus, targetUserId }: FamilyActionButtonProps) {
  const [status, setStatus] = useState<FamilyRelationshipStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRequest = () => {
    startTransition(async () => {
      const result = await sendFamilyRequest(targetUserId);
      if (result.success) {
        setStatus('pending_from_me');
        toast({ title: 'Request Sent', description: `Your family request has been sent.` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };
  
  const handleCancelRequest = () => {
    startTransition(async () => {
      const result = await cancelFamilyRequest(targetUserId);
      if (result.success) {
        setStatus('none');
        toast({ title: 'Request Canceled', description: `Your family request has been withdrawn.` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const handleResponse = (response: 'approve' | 'reject') => {
    startTransition(async () => {
      const result = await respondToFamilyRequest(targetUserId, response);
      if (result.success) {
        setStatus(response === 'approve' ? 'approved' : 'none');
        toast({ title: `Request ${response}d`, description: `You have ${response}d the family request.` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const isTransitioning = isPending;

  switch (status) {
    case 'none':
      return <Button size="sm" onClick={handleRequest} disabled={isTransitioning}><UserPlus className="mr-2 h-4 w-4" /> Add Family</Button>;
    case 'pending_from_me':
      return <Button size="sm" variant="outline" onClick={handleCancelRequest} disabled={isTransitioning}><Clock className="mr-2 h-4 w-4" /> Request Sent</Button>;
    case 'pending_from_them':
      return (
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={() => handleResponse('approve')} disabled={isTransitioning}><UserCheck className="mr-2 h-4 w-4" /> Accept</Button>
          <Button size="sm" variant="destructive" onClick={() => handleResponse('reject')} disabled={isTransitioning}><UserX className="mr-2 h-4 w-4" /> Reject</Button>
        </div>
      );
    case 'approved':
      return <Button size="sm" variant="secondary" disabled><UserCheck className="mr-2 h-4 w-4" /> Family Member</Button>;
    default:
      return null;
  }
}
