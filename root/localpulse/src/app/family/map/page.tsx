
import { getFamilyLocations } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Map, Users, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FamilyLocationsPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
  }

  const locations = await getFamilyLocations();

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="container mx-auto w-full max-w-2xl space-y-6">
        <Card className="shadow-lg border-border/60">
            <CardHeader>
                <CardTitle className="flex items-center text-3xl font-bold">
                    <Map className="w-8 h-8 mr-3 text-primary" />
                    Family Locations
                </CardTitle>
                <CardDescription>
                    A list of family members sharing their location with you. Click the coordinates to get directions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {locations.length > 0 ? (
                    <div className="space-y-4">
                        {locations.map((loc) => (
                            <div key={loc.id} className="p-4 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-primary/50">
                                        <AvatarImage src={loc.profilepictureurl || undefined} alt={loc.name} />
                                        <AvatarFallback>{loc.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-lg text-foreground">{loc.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Last updated: {new Date(loc.last_updated).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <Button asChild variant="secondary" size="sm">
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer">
                                        <MapPin className="w-4 h-4 mr-2"/>
                                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                        <ExternalLink className="w-3 h-3 ml-2"/>
                                    </a>
                                </Button>
                            </div>
                        ))}
                    </div>
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
