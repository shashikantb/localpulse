
import type { FC } from 'react';
import { notFound } from 'next/navigation';
import { getUser } from '@/app/actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UserCog } from 'lucide-react';
import UserEditForm from './edit-form-client';

export const dynamic = 'force-dynamic';

interface EditUserPageProps {
  params: { userId: string };
}

const EditUserPage: FC<EditUserPageProps> = async ({ params }) => {
  const userId = parseInt(params.userId, 10);
  if (isNaN(userId)) {
    notFound();
  }

  const user = await getUser(userId);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Users
          </Link>
        </Button>
      </header>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserCog className="mr-2 h-6 w-6 text-primary" />
            Edit User
          </CardTitle>
          <CardDescription>
            Modify details for <span className="font-semibold text-foreground">{user.name}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserEditForm user={user} />
        </CardContent>
      </Card>
    </div>
  );
};

export default EditUserPage;
