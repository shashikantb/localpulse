

import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, PlusCircle, CheckCircle, XCircle, Clock, BadgeCheck } from 'lucide-react';
import { getPaginatedUsers } from './actions';
import { Badge } from '@/components/ui/badge';
import UserActions from '@/components/admin/user-actions';
import type { UserStatus } from '@/lib/db-types';
import AdminTableControls from '@/components/admin/admin-table-controls';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: {
    query?: string;
    page?: string;
  };
}

const AdminManageUsersPage: FC<PageProps> = async ({ searchParams }) => {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  const limit = 10;

  const { users, totalCount } = await getPaginatedUsers(currentPage, limit, query);
  
  const totalPages = Math.ceil(totalCount / limit);

  const getStatusVariant = (status: UserStatus): "default" | "secondary" | "destructive" | "success" => {
    switch (status) {
        case 'verified': return 'success';
        case 'approved': return 'default';
        case 'pending_verification': return 'secondary';
        case 'pending': return 'secondary';
        case 'rejected': return 'destructive';
        default: return 'secondary';
    }
  }

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
        case 'verified': return <BadgeCheck className="w-3 h-3 mr-1 text-green-500" />;
        case 'approved': return <CheckCircle className="w-3 h-3 mr-1 text-primary-foreground" />;
        case 'pending_verification': return <Clock className="w-3 h-3 mr-1 text-yellow-500" />;
        case 'pending': return <Clock className="w-3 h-3 mr-1 text-yellow-500" />;
        case 'rejected': return <XCircle className="w-3 h-3 mr-1 text-red-500" />;
        default: return null;
    }
  }


  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Manage Users</h1>
          <p className="text-lg text-muted-foreground">View, search, or manage user accounts.</p>
        </div>
        <Button disabled>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add New User
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Users ({totalCount})</CardTitle>
          <CardDescription>A list of all registered users on the platform.</CardDescription>
           <div className="pt-2">
            <AdminTableControls
              searchPlaceholder="Search users by name or email..."
              createAction={null}
            />
           </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Joined At</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3 text-muted-foreground">{user.email}</td>
                    <td className="p-3">
                      <Badge variant={user.role === 'Admin' ? 'default' : user.role === 'Business' ? 'secondary' : 'outline'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-3">
                        <Badge variant={getStatusVariant(user.status)} className="capitalize">
                            {getStatusIcon(user.status)}
                            {user.status.replace('_', ' ')}
                        </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(user.createdat).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                       <UserActions user={user} />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-2" />
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-end mt-6">
                <AdminTableControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    showSearch={false}
                />
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManageUsersPage;
