
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
  if (!post.authorname || (post.authorrole !== 'Business' && post.authorrole !== 'Gorakshak')) return;

  try {
    const tokens = await db.getNearbyDeviceTokensDb(post.latitude, post.longitude, 20); // 20km radius

    if (tokens.length === 0) {
      console.log(`No nearby devices to notify for post ${post.id}`);
      return;
    }

    const message = {
      notification: {
        title: `New Pulse from ${post.authorname}!`,
        body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      },
      tokens: tokens,
    };
    
    console.log(`Sending notification for post ${post.id} to ${tokens.length} devices.`);
    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    
    console.log('Successfully sent message:', response.successCount, 'successes,', response.failureCount, 'failures');

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      console.log('List of tokens that caused failures:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession(); // user can be null

    // If authorId is provided, it must match the logged-in user.
    if (newPostData.authorId && (!user || user.id !== newPostData.authorId)) {
        return { error: 'Authentication mismatch. You can only post for yourself.' };
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
      authorid: user ? user.id : null, // Use logged-in user's ID or null
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    
    // Fetch the full post details, including joined author info
    const allPosts = await db.getPostsDb(undefined, user?.role);
    const finalPost = allPosts.find(p => p.id === addedPostDb.id);


    if (!finalPost) {
        return { error: 'Failed to retrieve post after creation.' };
    }

    revalidatePath('/');
    
    // Send notifications if the user is a Business or Gorakshak
    if (user && (user.role === 'Business' || user.role === 'Gorakshak')) {
      sendNotificationsForNewPost(finalPost).catch(err => {
        console.error("Background notification sending failed:", err);
      });
    }

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
