
import type { FC } from 'react';
import { notFound } from 'next/navigation';
import { getPostById } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { PostCard } from '@/components/post-card';

interface PostPageProps {
  params: {
    postId: string;
  };
}

const PostPage: FC<PostPageProps> = async ({ params }) => {
  const postId = parseInt(params.postId, 10);
  if (isNaN(postId)) {
    notFound();
  }

  // Fetch post and session in parallel
  const [post, { user: sessionUser }] = await Promise.all([
    getPostById(postId),
    getSession()
  ]);

  if (!post) {
    notFound();
  }

  return (
    <main className="flex min-h-svh flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl py-8">
        <PostCard 
          key={post.id} 
          post={post} 
          userLocation={null} // Can't get viewing user's location on server for distance calc
          sessionUser={sessionUser} 
        />
      </div>
    </main>
  );
};

export default PostPage;
