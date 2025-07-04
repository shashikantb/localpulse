
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPendingUsers, approveUser, rejectUser } from './actions';
import { UserCheck, UserX, Building, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const UserApprovalCard: FC<{ user: Awaited<ReturnType<typeof getPendingUsers>>[0] }> = ({ user }) => {

  const handleApprove = async () => {
    'use server';
    await approveUser(user.id);
    revalidatePath('/admin/approvals');
  }
  
  const handleReject = async () => {
    'use server';
    await rejectUser(user.id);
    revalidatePath('/admin/approvals');
  }

  return (
    <div className="p-4 border rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card hover:bg-muted/50 transition-colors">
      <div className="space-y-1">
        <p className="font-semibold text-lg text-foreground">{user.name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> {user.email}</p>
        <div className="flex items-center gap-4 pt-1">
            <Badge variant={user.role === 'Business' ? 'secondary' : 'default'} className="capitalize">
              {user.role === 'Business' ? <Building className="w-3 h-3 mr-1"/> : <ShieldCheck className="w-3 h-3 mr-1"/>}
              {user.role}
            </Badge>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Joined: {new Date(user.createdat).toLocaleDateString()}</p>
        </div>
      </div>
      <form className="flex gap-2 self-start md:self-center flex-shrink-0">
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


const AdminApprovalsPage: FC = async () => {
  const pendingUsers = await getPendingUsers();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">User Approvals</h1>
        <p className="text-lg text-muted-foreground">Review and approve new user registrations.</p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Pending Accounts</CardTitle>
          <CardDescription>
            {pendingUsers.length > 0 
              ? `There are ${pendingUsers.length} user(s) awaiting approval.`
              : `There are no users awaiting approval.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length > 0 ? (
            <div className="space-y-4">
              {pendingUsers.map(user => (
                <UserApprovalCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">All clear! No pending approvals.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminApprovalsPage;
