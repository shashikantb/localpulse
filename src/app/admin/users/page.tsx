
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, PlusCircle, Search } from 'lucide-react';

// Placeholder data
const sampleUsers = [
  { id: 1, name: "Alice Wonderland", email: "alice@example.com", role: "User", joinedAt: new Date().toISOString(), posts: 15 },
  { id: 2, name: "Bob The Builder", email: "bob@example.com", role: "User", joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(), posts: 3 },
  { id: 3, name: "Charlie Brown", email: "charlie@example.com", role: "Admin", joinedAt: new Date(Date.now() - 86400000 * 30).toISOString(), posts: 0 },
];

const AdminManageUsersPage: FC = () => {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Manage Users</h1>
          <p className="text-lg text-muted-foreground">View, edit roles, or manage user accounts.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add New User
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>A list of all registered users on the platform.</CardDescription>
           <div className="pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search users by name, email, role..." className="pl-10 w-full md:w-1/2 lg:w-1/3" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3 font-semibold">ID</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Posts</th>
                  <th className="p-3 font-semibold">Joined At</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sampleUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{user.id}</td>
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'Admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">{user.posts}</td>
                    <td className="p-3">{new Date(user.joinedAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <Button variant="outline" size="sm">View</Button>
                      <Button variant="outline" size="sm" className="text-yellow-600 hover:text-yellow-700 border-yellow-500 hover:border-yellow-600">Edit Role</Button>
                      <Button variant="destructive" size="sm">Suspend</Button>
                    </td>
                  </tr>
                ))}
                {sampleUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-2" />
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           {/* Placeholder for Pagination */}
           <div className="flex justify-end mt-6">
            <Button variant="outline" size="sm" className="mr-2">Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManageUsersPage;
