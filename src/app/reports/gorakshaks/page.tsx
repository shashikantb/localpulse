
import type { FC } from 'react';
import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { getGorakshakReport } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileBarChart, Info, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const GorakshakReportPage: FC = async () => {
    const { user } = await getSession();

    if (!user || user.role !== 'Gorakshak Admin') {
        redirect('/');
    }

    if (!user.latitude || !user.longitude) {
        return (
            <div className="flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle>Location Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Location Services Needed</AlertTitle>
                            <AlertDescription>
                                To view this report, please enable location services in your browser and for this site, then return to your <Link href={`/users/${user.id}`} className="underline">profile page</Link> and try again.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const gorakshaks = await getGorakshakReport(user.latitude, user.longitude);

    return (
        <div className="flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16">
            <div className="w-full max-w-4xl space-y-6">
                <header>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center">
                        <FileBarChart className="w-9 h-9 mr-3 text-primary"/>
                        Gorakshak Report
                    </h1>
                    <p className="text-lg text-muted-foreground">A list of all active Gorakshaks, sorted by distance from you.</p>
                </header>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Gorakshak Users</CardTitle>
                        <CardDescription>
                            Found {gorakshaks.length} Gorakshak(s) with available location data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Mobile Number</TableHead>
                                        <TableHead>Distance</TableHead>
                                        <TableHead>Location</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gorakshaks.map((g) => (
                                        <TableRow key={g.id}>
                                            <TableCell className="font-medium">
                                                <Button variant="link" asChild className="p-0 h-auto">
                                                    <Link href={`/users/${g.id}`}>{g.name}</Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                {g.mobilenumber ? (
                                                    <a href={`tel:${g.mobilenumber}`} className="flex items-center gap-2 hover:underline">
                                                        <Phone className="w-4 h-4 text-primary"/> {g.mobilenumber}
                                                    </a>
                                                ) : 'N/A'}
                                            </TableCell>
                                            <TableCell>{(g.distance / 1000).toFixed(2)} km</TableCell>
                                            <TableCell>
                                                 <a href={`https://www.google.com/maps?q=${g.latitude},${g.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline text-blue-500">
                                                    <MapPin className="w-4 h-4"/> View on Map
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {gorakshaks.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                No Gorakshaks with location data found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GorakshakReportPage;
