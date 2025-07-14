
import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Users, FileText, Activity } from 'lucide-react';
import { getAdminDashboardStats } from './actions';

const AdminDashboardPage: FC = async () => {
  const { totalPosts, totalUsers, dailyActiveUsers } = await getAdminDashboardStats();
  
  const stats = [
    { title: 'Total Posts', value: totalPosts.toLocaleString(), icon: FileText, color: 'text-blue-500' },
    { title: 'Total Users', value: totalUsers.toLocaleString(), icon: Users, color: 'text-green-500' },
    { title: 'Users Active Today', value: dailyActiveUsers.toLocaleString(), icon: Activity, color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">Welcome back, Administrator!</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart className="mr-2 h-6 w-6 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Overview of recent platform engagement (Placeholder).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-md flex items-center justify-center">
              <p className="text-muted-foreground">Chart data will be displayed here.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-6 w-6 text-primary" />
              Quick Links
            </CardTitle>
            <CardDescription>Frequently accessed admin tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="ghost" asChild className="w-full justify-start p-3 h-auto text-base">
                <Link href="/admin/posts">Manage Posts</Link>
            </Button>
             <Button variant="ghost" asChild className="w-full justify-start p-3 h-auto text-base">
                <Link href="/admin/users">Manage Users</Link>
            </Button>
             <Button variant="ghost" asChild className="w-full justify-start p-3 h-auto text-base" disabled>
                <Link href="#">View System Logs</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
