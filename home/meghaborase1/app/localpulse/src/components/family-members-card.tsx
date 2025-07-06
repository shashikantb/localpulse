
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, ExternalLink } from 'lucide-react';
import type { FamilyMember } from '@/lib/db-types';
import LocationSharingToggle from './location-sharing-toggle';

interface FamilyMembersCardProps {
  familyMembers: FamilyMember[];
}

const FamilyMembersCard: FC<FamilyMembersCardProps> = ({ familyMembers }) => {
  return (
    <div className="space-y-4 pt-4 border-t border-border/30">
      {familyMembers.map((member) => (
        <div
          key={member.id}
          className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left side: Avatar and Name */}
            <Link href={`/users/${member.id}`} className="flex items-center space-x-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profilepictureurl || undefined} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{member.name}</p>
                    {member.they_are_sharing_with_me && member.latitude && member.longitude ? (
                        <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${member.latitude},${member.longitude}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MapPin className="w-3 h-3 mr-1"/>
                            View Location
                            <ExternalLink className="w-3 h-3 ml-1"/>
                        </a>
                    ) : member.they_are_sharing_with_me ? (
                        <p className="text-xs text-muted-foreground mt-0.5">Location not available</p>
                    ) : null}
                </div>
            </Link>
            {/* Right side: Toggle */}
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
