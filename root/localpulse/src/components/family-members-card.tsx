
import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, MapPin, Map } from 'lucide-react';
import type { FamilyMember } from '@/lib/db-types';
import LocationSharingToggle from './location-sharing-toggle';
import { Button } from '@/components/ui/button';

interface FamilyMembersCardProps {
  familyMembers: FamilyMember[];
}

const FamilyMembersCard: FC<FamilyMembersCardProps> = ({ familyMembers }) => {
  return (
    <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center">
                <Users className="w-6 h-6 mr-2 text-primary" />
                Family Members
            </CardTitle>
            <CardDescription>
              Manage location sharing with your family.
            </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
            <Link href="/family/map">
                <Map className="w-4 h-4 mr-2" />
                View Locations
            </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {familyMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between space-x-4 p-2 rounded-lg hover:bg-muted"
            >
                <Link href={`/users/${member.id}`} className="flex items-center space-x-4 flex-1">
                    <Avatar>
                        <AvatarImage src={member.profilepictureurl || undefined} alt={member.name} />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{member.name}</span>
                        {member.they_are_sharing_with_me && (
                            <MapPin className="w-4 h-4 text-green-500" title={`${member.name} is sharing their location with you.`}/>
                        )}
                    </div>
                </Link>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Share My Location</span>
                    <LocationSharingToggle 
                        targetUserId={member.id} 
                        initialIsSharing={member.i_am_sharing_with_them} 
                    />
                </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FamilyMembersCard;
