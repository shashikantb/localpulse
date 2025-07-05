
import { getFamilyLocations } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const FamilyMap = dynamic(() => import('@/components/family-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-muted rounded-lg">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

export default async function FamilyMapPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
  }

  const locations = await getFamilyLocations();

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
                {locations.length > 0 ? (
                    <FamilyMap locations={locations} currentUser={user} />
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
