
import type { FC } from 'react';
import { FileText, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PostActions from '@/components/admin/post-actions';
import CreateAnnouncementDialog from './create-announcement-dialog';
import AdminTableControls from '@/components/admin/admin-table-controls';
import { getPaginatedPosts } from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: {
    query?: string;
    page?: string;
  };
}

const AdminManagePostsPage: FC<PageProps> = async ({ searchParams }) => {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  const limit = 10;

  const { posts, totalCount } = await getPaginatedPosts(currentPage, limit, query);
  
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Manage Posts</h1>
          <p className="text-lg text-muted-foreground">View, search, or delete user posts.</p>
        </div>
        <CreateAnnouncementDialog>
            <Button>
              <PlusCircle className="mr-2 h-5 w-5" />
              Create Announcement
            </Button>
        </CreateAnnouncementDialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Posts ({totalCount})</CardTitle>
          <CardDescription>A list of all posts on the platform.</CardDescription>
          <div className="pt-2">
            <AdminTableControls
              searchPlaceholder="Search posts by content, author, city..."
              createAction={null}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3 font-semibold">ID</th>
                  <th className="p-3 font-semibold">Content Snippet</th>
                  <th className="p-3 font-semibold">Author</th>
                  <th className="p-3 font-semibold">City</th>
                  <th className="p-3 font-semibold">Likes</th>
                  <th className="p-3 font-semibold">Created At</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{post.id}</td>
                    <td className="p-3 max-w-xs truncate">{post.content}</td>
                    <td className="p-3">{post.authorname || 'Anonymous'}</td>
                    <td className="p-3">{post.city || 'N/A'}</td>
                    <td className="p-3">{post.likecount}</td>
                    <td className="p-3">{new Date(post.createdat).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                        <PostActions post={post} />
                    </td>
                  </tr>
                ))}
                 {posts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-2" />
                      No posts found.
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

export default AdminManagePostsPage;
