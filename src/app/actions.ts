
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost, Comment, NewComment } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Action to get all posts
export async function getPosts(): Promise<Post[]> {
  try {
    const posts = db.getPostsDb();
    return posts;
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    return [];
  }
}

// Action to add a new post
export async function addPost(newPostData: NewPost): Promise<Post> {
  try {
    const addedPost = db.addPostDb(newPostData);
    revalidatePath('/'); 
    return addedPost;
  } catch (error) {
    console.error("Server action error adding post:", error);
    throw new Error('Failed to add post via server action.');
  }
}

// Action to toggle like on a post
export async function toggleLikePost(postId: number, increment: boolean): Promise<Post | null> {
  try {
    const updatedPost = db.updatePostLikeCountDb(postId, increment);
    if (updatedPost) {
      revalidatePath('/'); // Revalidate to show updated like count
      // Consider revalidating specific post path if you have individual post pages: revalidatePath(`/posts/${postId}`);
    }
    return updatedPost;
  } catch (error) {
    console.error(`Server action error toggling like for post ${postId}:`, error);
    return null;
  }
}

// Action to add a comment
export async function addComment(commentData: NewComment): Promise<Comment> {
  try {
    const addedComment = db.addCommentDb(commentData);
    revalidatePath('/'); // Revalidate to show new comment
    // Consider revalidating specific post path: revalidatePath(`/posts/${commentData.postId}`);
    return addedComment;
  } catch (error) {
    console.error(`Server action error adding comment to post ${commentData.postId}:`, error);
    throw new Error('Failed to add comment via server action.');
  }
}

// Action to get comments for a post
export async function getComments(postId: number): Promise<Comment[]> {
  try {
    const comments = db.getCommentsByPostIdDb(postId);
    return comments;
  } catch (error) {
    console.error(`Server action error fetching comments for post ${postId}:`, error);
    return [];
  }
}
