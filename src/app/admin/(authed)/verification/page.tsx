
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getVerificationRequests, approveVerification, rejectVerification } from './actions';
import { UserCheck, UserX, Building, Mail, MapPin, BadgeCheck, Phone } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VerificationRequestCard: FC<{ user: Awaited<ReturnType<typeof getVerificationRequests>>[0] }> = ({ user }) => {

  const handleApprove = async () => {
    'use server';
    await approveVerification(user.id);
    revalidatePath('/admin/verification');
  }
  
  const handleReject = async () => {
    'use server';
    await rejectVerification(user.id);
    revalidatePath('/admin/verification');
  }

  return (
    <div className="p-4 border rounded-lg flex flex-col md:flex-row items-start justify-between gap-4 bg-card hover:bg-muted/50 transition-colors">
      <div className="space-y-2 flex-1">
        <p className="font-semibold text-lg text-foreground">{user.name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Building className="w-4 h-4" /> {user.business_category}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> {user.email}</p>
        {user.mobilenumber && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-4 h-4" /> {user.mobilenumber}</p>}
        {user.latitude && user.longitude && (
             <a href={`https://www.google.com/maps?q=${user.latitude},${user.longitude}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline flex items-center gap-2">
                <MapPin className="w-4 h-4"/> View on Map ({user.latitude.toFixed(4)}, {user.longitude.toFixed(4)})
            </a>
        )}
      </div>
      <form className="flex gap-2 self-start md:self-center flex-shrink-0 flex-wrap">
         <Button formAction={handleApprove} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
           <UserCheck className="mr-2 h-4 w-4" /> Approve
         </Button>
         <Button formAction={handleReject} variant="destructive" size="sm">
           <UserX className="mr-2 h-4 w-4" /> Reject
         </Button>
      </form>
    </div>
  )
}


const AdminVerificationPage: FC = async () => {
  const pendingUsers = await getVerificationRequests();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Business Verification</h1>
        <p className="text-lg text-muted-foreground">Review and verify business accounts.</p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Pending Verifications</CardTitle>
          <CardDescription>
            {pendingUsers.length > 0 
              ? `There are ${pendingUsers.length} business(es) awaiting verification.`
              : `There are no businesses awaiting verification.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length > 0 ? (
            <div className="space-y-4">
              {pendingUsers.map(user => (
                <VerificationRequestCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
                <BadgeCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">All clear! No pending verifications.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVerificationPage;
