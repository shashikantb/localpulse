'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts } from '@/lib/db-types';
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
    const posts = await db.getPostsDb();
    // Map to ensure frontend consistent casing if needed, though pg might return lowercase
    return posts.map(post => ({
      ...post,
      createdAt: post.createdat, // map db 'createdat' to 'createdAt' for client
      likeCount: post.likecount,
      mediaUrl: post.mediaurl,
      mediaType: post.mediatype,
    }));
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    return [];
  }
}

// Action to add a new post
export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      ...newPostData,
      city: cityName,
    };

    const addedPost = await db.addPostDb(postDataForDb);
    revalidatePath('/'); 
    return {
        post: {
          ...addedPost,
          createdAt: addedPost.createdat, // map db 'createdat' to 'createdAt' for client
          likeCount: addedPost.likecount,
          mediaUrl: addedPost.mediaurl,
          mediaType: addedPost.mediatype,
        }
    };
  } catch (error: any) {
    console.error("Server action error adding post:", error);
    // Return an error object instead of throwing, so client can handle it gracefully
    return { error: error.message || 'Failed to add post due to an unknown server error.' };
  }
}

// Action to toggle like on a post
export async function toggleLikePost(postId: number, increment: boolean): Promise<Post | null> {
  try {
    const updatedPost = await db.updatePostLikeCountDb(postId, increment);
    if (updatedPost) {
      revalidatePath('/');
       return {
        ...updatedPost,
        createdAt: updatedPost.createdat,
        likeCount: updatedPost.likecount,
        mediaUrl: updatedPost.mediaurl,
        mediaType: updatedPost.mediatype,
      };
    }
    return null;
  } catch (error) {
    console.error(`Server action error toggling like for post ${postId}:`, error);
    return null;
  }
}

// Action to add a comment
export async function addComment(commentData: NewComment): Promise<Comment> {
  try {
    const addedComment = await db.addCommentDb(commentData);
    revalidatePath('/'); 
    return {
        ...addedComment,
        postId: addedComment.postid,
        createdAt: addedComment.createdat,
    };
  } catch (error: any) {
    console.error(`Server action error adding comment to post ${commentData.postId}:`, error);
    throw new Error(error.message || 'Failed to add comment via server action.');
  }
}

// Action to get comments for a post
export async function getComments(postId: number): Promise<Comment[]> {
  try {
    const comments = await db.getCommentsByPostIdDb(postId);
    return comments.map(comment => ({
        ...comment,
        postId: comment.postid,
        createdAt: comment.createdat,
    }));
  } catch (error) {
    console.error(`Server action error fetching comments for post ${postId}:`, error);
    return [];
  }
}

// Action to record a visit and get current counts
export async function recordVisitAndGetCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.incrementAndGetVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error recording visit and getting counts:", error);
    return { totalVisits: 0, dailyVisits: 0 }; 
  }
}

// Action to get current visitor counts without incrementing
export async function getCurrentVisitorCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.getVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error getting current visitor counts:", error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}

