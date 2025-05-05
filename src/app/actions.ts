'use server';

import * as db from '@/lib/db';
import type { Post, NewPost } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Action to get all posts
export async function getPosts(): Promise<Post[]> {
  try {
    // Directly call the synchronous DB function within the server action
    const posts = db.getPosts();
    return posts;
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    // In a real app, you might want more sophisticated error handling
    return [];
  }
}

// Action to add a new post
export async function addPost(newPostData: NewPost): Promise<Post> {
  try {
     // Directly call the synchronous DB function
    const addedPost = db.addPost(newPostData);
    revalidatePath('/'); // Revalidate the home page cache after adding a post
    return addedPost;
  } catch (error) {
    console.error("Server action error adding post:", error);
    // Rethrow the error to be caught by the client-side caller
    // Or return a specific error object/message
    throw new Error('Failed to add post via server action.');
  }
}
