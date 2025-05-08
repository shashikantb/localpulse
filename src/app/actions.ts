
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost } from '@/lib/db'; // Renamed NewPost to ClientNewPost
import { revalidatePath } from 'next/cache';

// Placeholder for geocoding service - replace with actual API call in a real app
async function geocodeCoordinates(latitude: number, longitude: number): Promise<string | null> {
  // In a real application, you would call a geocoding API here.
  // Example:
  // try {
  //   const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
  //   if (!response.ok) throw new Error('Geocoding API request failed');
  //   const data = await response.json();
  //   return data.city || data.locality || null;
  // } catch (error) {
  //   console.error("Geocoding error:", error);
  //   return null; // Or a default like "Unknown Location"
  // }

  console.log(`Geocoding placeholder for: ${latitude}, ${longitude}`);
  // Simulate some city names based on rough lat/lon ranges for demonstration
  if (latitude > 40.5 && latitude < 40.9 && longitude > -74.3 && longitude < -73.7) { // Rough NYC
      return "New York";
  } else if (latitude > 33.8 && latitude < 34.2 && longitude > -118.5 && longitude < -118.0) { // Rough LA
      return "Los Angeles";
  } else if (latitude > 51.3 && latitude < 51.7 && longitude > -0.5 && longitude < 0.3) { // Rough London
      return "London";
  } else if (latitude > 35.5 && latitude < 35.9 && longitude > 139.5 && longitude < 139.9) { // Rough Tokyo
    return "Tokyo";
  }
  return "Unknown City"; // Default fallback
}


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
export async function addPost(newPostData: ClientNewPost): Promise<Post> {
  try {
    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      ...newPostData,
      city: cityName,
    };

    const addedPost = db.addPostDb(postDataForDb);
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
