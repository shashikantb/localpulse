
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, PlusCircle, Search } from 'lucide-react';

// Placeholder data - in a real app, this would come from getPosts() or a similar admin-specific function
const samplePosts = [
  { id: 1, content: "First post content here...", author: "UserA", createdAt: new Date().toISOString(), city: "New York", likes: 10 },
  { id: 2, content: "Another interesting post about local events.", author: "UserB", createdAt: new Date(Date.now() - 3600000).toISOString(), city: "Los Angeles", likes: 5 },
  { id: 3, content: "A short update.", author: "UserC", createdAt: new Date(Date.now() - 7200000).toISOString(), city: "Chicago", likes: 22 },
];


const AdminManagePostsPage: FC = () => {
  // const [posts, setPosts] = useState(samplePosts); // Would use state and fetch real data
  // const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Manage Posts</h1>
          <p className="text-lg text-muted-foreground">View, edit, or delete user posts.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-5 w-5" />
          Create New Post
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>A list of all posts on the platform.</CardDescription>
          <div className="pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search posts by content, author, city..." className="pl-10 w-full md:w-1/2 lg:w-1/3" />
            </div>
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
                {samplePosts.map((post) => (
                  <tr key={post.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{post.id}</td>
                    <td className="p-3 max-w-xs truncate">{post.content}</td>
                    <td className="p-3">{post.author}</td>
                    <td className="p-3">{post.city}</td>
                    <td className="p-3">{post.likes}</td>
                    <td className="p-3">{new Date(post.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <Button variant="outline" size="sm">View</Button>
                      <Button variant="outline" size="sm" className="text-yellow-600 hover:text-yellow-700 border-yellow-500 hover:border-yellow-600">Edit</Button>
                      <Button variant="destructive" size="sm">Delete</Button>
                    </td>
                  </tr>
                ))}
                 {samplePosts.length === 0 && (
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

export default AdminManagePostsPage;
