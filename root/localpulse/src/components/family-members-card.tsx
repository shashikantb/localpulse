
import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import type { User } from '@/lib/db-types';

interface FamilyMembersCardProps {
  familyMembers: User[];
}

const FamilyMembersCard: FC<FamilyMembersCardProps> = ({ familyMembers }) => {
  return (
    <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center">
            <Users className="w-6 h-6 mr-2 text-primary" />
            Family Members
        </CardTitle>
        <CardDescription>
          Connected family members.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {familyMembers.map((member) => (
            <Link
              key={member.id}
              href={`/users/${member.id}`}
              className="flex items-center space-x-4 p-2 rounded-lg hover:bg-muted"
            >
              <Avatar>
                <AvatarImage src={member.profilepictureurl || undefined} alt={member.name} />
                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{member.name}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FamilyMembersCard;
