
import { getFamilyLocations } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FamilyMemberLocation, FamilyMemberLocationWithIcon } from '@/lib/db-types';

export const dynamic = 'force-dynamic';

const FamilyMap = dynamic(() => import('@/components/family-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-muted rounded-lg">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

const createIconMarkup = (user: FamilyMemberLocation) => {
    return renderToStaticMarkup(
      <div className="relative">
        <Avatar className="h-10 w-10 border-2 border-primary bg-background p-0.5">
          <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-primary"></div>
      </div>
    );
};


export default async function FamilyMapPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
  }

  const locations = await getFamilyLocations();

  const locationsWithIcons: FamilyMemberLocationWithIcon[] = locations.map(loc => ({
      ...loc,
      iconHtml: createIconMarkup(loc),
  }));

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="container mx-auto w-full max-w-5xl space-y-6">
        <Card className="shadow-lg border-border/60">
            <CardHeader>
                <CardTitle className="flex items-center text-3xl font-bold">
                    <Map className="w-8 h-8 mr-3 text-primary" />
                    Family Map
                </CardTitle>
                <CardDescription>
                    Live locations of family members who are sharing with you. Locations update automatically.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {locationsWithIcons.length > 0 ? (
                    <FamilyMap locations={locationsWithIcons} currentUser={user} />
                ) : (
                    <div className="text-center py-16 text-muted-foreground bg-muted/50 rounded-lg">
                        <Users className="mx-auto h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg font-semibold">No locations to display</p>
                        <p className="text-sm">
                            No family members are currently sharing their location with you.
                        </p>
                         <Button asChild size="sm" className="mt-4">
                            <Link href={`/users/${user.id}`}>Back to Profile</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
