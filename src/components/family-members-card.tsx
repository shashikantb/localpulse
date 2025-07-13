

'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import type { FamilyMember } from '@/lib/db-types';
import LocationSharingToggle from './location-sharing-toggle';
import { formatDistanceToNowStrict } from 'date-fns';
import { getFamilyMembers } from '@/app/actions';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface FamilyMembersCardProps {
  userId: number;
}

const FamilyMembersCard: FC<FamilyMembersCardProps> = ({ userId }) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();

  const fetchFamilyMembers = React.useCallback(async () => {
    try {
      const members = await getFamilyMembers(userId);
      setFamilyMembers(members);
    } catch (error) {
      console.error("Failed to fetch family members:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load family members.' });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchFamilyMembers();
  }, [fetchFamilyMembers]);

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      await fetchFamilyMembers();
      toast({ title: 'Refreshed', description: 'Family member locations have been updated.' });
    });
  };

  if (isLoading) {
    return (
        <div className="space-y-4">
            <div className="p-3 border rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
                <Skeleton className="h-6 w-12" />
            </div>
        </div>
    );
  }

  if (familyMembers.length === 0) {
      return <p className="text-sm text-center text-muted-foreground py-4">You haven't added any family members yet.</p>
  }
  
  return (
    <div className="space-y-4">
      <div className="text-right">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh Locations
          </Button>
      </div>
      {familyMembers.map((member) => (
        <div
          key={member.id}
          className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link href={`/users/${member.id}`} className="flex items-center space-x-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profilepictureurl || undefined} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{member.name}</p>
                    {member.they_are_sharing_with_me && member.latitude && member.longitude ? (
                        <div className="flex items-center gap-2 mt-0.5">
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${member.latitude},${member.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline flex items-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MapPin className="w-3 h-3 mr-1"/>
                                View Location
                                <ExternalLink className="w-3 h-3 ml-1"/>
                            </a>
                            {member.last_updated && (
                                <span className="text-xs text-muted-foreground">
                                    ({formatDistanceToNowStrict(new Date(member.last_updated), { addSuffix: true })})
                                </span>
                            )}
                        </div>
                    ) : member.they_are_sharing_with_me ? (
                        <p className="text-xs text-muted-foreground mt-0.5">Location not available</p>
                    ) : null}
                </div>
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                <span className="text-sm text-muted-foreground">Share My Location</span>
                <LocationSharingToggle
                    targetUserId={member.id}
                    initialIsSharing={member.i_am_sharing_with_them}
                />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FamilyMembersCard;
