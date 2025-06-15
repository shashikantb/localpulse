
import type { FC } from 'react';
import { getPosts } from './actions';
import PostFeedClient from '@/components/post-feed-client';
import { Rss } from 'lucide-react';
import type { Post } from '@/lib/db-types';

// This is now a Server Component
const HomePage: FC = async () => {
  let initialPosts: Post[] = [];
  try {
    // Fetch only the first page of posts for the initial server render
    // For simplicity, getPosts() fetches all; ideally, it would support pagination.
    // We will let the client component handle the "first page" slicing for now.
    const allFetchedPosts = await getPosts(); 
    initialPosts = allFetchedPosts; // Pass all, client will paginate
  } catch (error) {
    console.error("Error fetching initial posts for server component:", error);
    // Handle error appropriately, maybe pass an error prop or empty array
    initialPosts = [];
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <header className="text-center space-y-0 sm:space-y-1 py-1 sm:py-2 md:py-3 bg-card/90 backdrop-blur-lg rounded-xl shadow-2xl border border-border/50 transform hover:scale-[1.01] transition-transform duration-300 md:mb-6">
            <div className="flex items-center justify-center space-x-1 sm:space-x-1.5">
              <Rss className="h-4 w-4 sm:h-5 md:h-6 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-hsl),0.5)]" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary tracking-tight drop-shadow-lg">
                LocalPulse
              </h1>
            </div>
            <p className="text-xs sm:text-xs text-muted-foreground font-medium">Catch the Vibe, Share the Pulse.</p>
        </header>
        
        <PostFeedClient initialPosts={initialPosts} />
      </div>
    </main>
  );
};

export default HomePage;
