
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts, User } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { admin as firebaseAdmin } from '@/lib/firebase-admin';
import { getSession } from './auth/actions';

async function geocodeCoordinates(latitude: number, longitude: number): Promise<string | null> {
  // ... (existing geocode placeholder logic)
  if (latitude > 40.5 && latitude < 40.9 && longitude > -74.3 && longitude < -73.7) return "New York";
  if (latitude > 33.8 && latitude < 34.2 && longitude > -118.5 && longitude < -118.0) return "Los Angeles";
  if (latitude > 51.3 && latitude < 51.7 && longitude > -0.5 && longitude < 0.3) return "London";
  if (latitude > 35.5 && latitude < 35.9 && longitude > 139.5 && longitude < 139.9) return "Tokyo";
  return "Unknown City";
}

export async function getPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit
    } : undefined;

    const posts = await db.getPostsDb(dbOptions, user?.role);
    return posts.map(post => ({
      ...post,
      createdAt: post.createdat,
      likeCount: post.likecount,
      mediaUrl: post.mediaurl,
      mediaType: post.mediatype,
      hashtags: post.hashtags || [],
      authorId: post.authorid,
      authorName: post.authorname,
      authorRole: post.authorrole,
    }));
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    return [];
  }
}

export async function getMediaPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const dbOptions = options ? { limit: options.limit, offset: (options.page - 1) * options.limit } : undefined;
    const posts = await db.getMediaPostsDb(dbOptions);
    return posts.map(post => ({
      ...post,
      createdAt: post.createdat,
      likeCount: post.likecount,
      mediaUrl: post.mediaurl,
      mediaType: post.mediatype,
      hashtags: post.hashtags || [],
      authorId: post.authorid,
      authorName: post.authorname,
      authorRole: post.authorrole,
    }));
  } catch (error) {
    console.error("Server action error fetching media posts:", error);
    return [];
  }
}

async function sendNotificationsForNewPost(post: Post) {
  // ... (existing notification logic)
}

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession();
    if (!user || user.id !== newPostData.authorId) {
      return { error: 'Authentication failed. You must be logged in to post.' };
    }
     if (user.role !== 'Business') {
      return { error: 'Permission denied. Only Business users can create posts.' };
    }

    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      content: newPostData.content,
      latitude: newPostData.latitude,
      longitude: newPostData.longitude,
      mediaurl: newPostData.mediaUrl,
      mediatype: newPostData.mediaType,
      hashtags: newPostData.hashtags || [], 
      city: cityName,
      authorid: newPostData.authorId,
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    
    // We need to fetch the post again to join author details
    const finalPost = (await db.getPostsDb({ limit: 1, offset: 0 }, user.role)).find(p => p.id === addedPostDb.id);

    if (!finalPost) {
        return { error: 'Failed to retrieve post after creation.' };
    }

    revalidatePath('/');
    
    sendNotificationsForNewPost(finalPost).catch(err => {
      console.error("Background notification sending failed:", err);
    });

    return { post: finalPost };
  } catch (error: any) {
    console.error("Server action error adding post:", error);
    return { error: error.message || 'Failed to add post due to an unknown server error.' };
  }
}


export async function likePost(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    const updatedPost = await db.incrementPostLikeCountDb(postId);
    if (updatedPost) {
      revalidatePath('/'); 
      return { post: { ...updatedPost } }; // a bit simplified, but should work
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    console.error(`Server action error toggling like for post ${postId}:`, error);
    return { error: error.message || `Failed to update like count for post ${postId} due to a server error.` };
  }
}


export async function addComment(commentData: NewComment): Promise<Comment> {
  try {
    const { user } = await getSession();
    const authorName = user ? user.name : 'PulseFan';
    
    const addedComment = await db.addCommentDb({ ...commentData, author: authorName });
    revalidatePath('/');
    return addedComment;
  } catch (error: any) {
    console.error(`Server action error adding comment to post ${commentData.postId}:`, error);
    throw new Error(error.message || 'Failed to add comment via server action.');
  }
}

export async function getComments(postId: number): Promise<Comment[]> {
  try {
    const comments = await db.getCommentsByPostIdDb(postId);
    return comments;
  } catch (error) {
    console.error(`Server action error fetching comments for post ${postId}:`, error);
    return [];
  }
}

// ... (other existing functions like recordVisitAndGetCounts, registerDeviceToken, etc.)
export async function recordVisitAndGetCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.incrementAndGetVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error recording visit and getting counts:", error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}

export async function getCurrentVisitorCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.getVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error getting current visitor counts:", error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}

export async function registerDeviceToken(
  token: string,
  latitude?: number,
  longitude?: number
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: 'Device token is required.' };
  }
  try {
    await db.addOrUpdateDeviceTokenDb(token, latitude, longitude);
    console.log(`Device token registered/updated: ${token.substring(0,20)}...`);
    return { success: true };
  } catch (error: any) {
    console.error('Server action error registering device token:', error);
    return { success: false, error: error.message || 'Failed to register device token.' };
  }
}

export async function checkForNewerPosts(latestPostIdClientKnows: number): Promise<{ hasNewerPosts: boolean; count: number }> {
  try {
    if (latestPostIdClientKnows === 0) { 
        const anyPosts = await db.getPostsDb(); 
        return { hasNewerPosts: anyPosts.length > 0, count: anyPosts.length };
    }
    const count = await db.getNewerPostsCountDb(latestPostIdClientKnows);
    return { hasNewerPosts: count > 0, count };
  } catch (error) {
    console.error("Server action error checking for newer posts:", error);
    return { hasNewerPosts: false, count: 0 };
  }
}
