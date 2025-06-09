
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { admin as firebaseAdmin } from '@/lib/firebase-admin'; // Import Firebase Admin

async function geocodeCoordinates(latitude: number, longitude: number): Promise<string | null> {
  console.log(`Geocoding placeholder for: ${latitude}, ${longitude}`);
  if (latitude > 40.5 && latitude < 40.9 && longitude > -74.3 && longitude < -73.7) {
      return "New York";
  } else if (latitude > 33.8 && latitude < 34.2 && longitude > -118.5 && longitude < -118.0) {
      return "Los Angeles";
  } else if (latitude > 51.3 && latitude < 51.7 && longitude > -0.5 && longitude < 0.3) {
      return "London";
  } else if (latitude > 35.5 && latitude < 35.9 && longitude > 139.5 && longitude < 139.9) {
    return "Tokyo";
  }
  return "Unknown City";
}


export async function getPosts(): Promise<Post[]> {
  try {
    const posts = await db.getPostsDb();
    return posts.map(post => ({
      ...post,
      createdAt: post.createdat,
      likeCount: post.likecount,
      mediaUrl: post.mediaurl,
      mediaType: post.mediatype,
      hashtags: post.hashtags || [], // Ensure hashtags is an array
    }));
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    return [];
  }
}

async function sendNotificationsForNewPost(post: Post) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || firebaseAdmin.apps.length === 0) {
    console.warn('Firebase Admin SDK not initialized. Skipping push notifications.');
    return;
  }

  try {
    const nearbyTokens = await db.getNearbyDeviceTokensDb(post.latitude, post.longitude, 10); // 10km radius

    if (nearbyTokens.length === 0) {
      console.log('No nearby devices found to notify for new post.');
      return;
    }

    const message = {
      notification: {
        title: 'New Pulse Nearby!',
        body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      },
      data: {
        postId: String(post.id),
        // You can add more data here, like a link to the post or app screen
      },
      tokens: nearbyTokens, // Send to multiple tokens
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} messages for new post.`);
    if (response.failureCount > 0) {
      response.responses.forEach(resp => {
        if (!resp.success) {
          console.error('Failed to send notification to a token:', resp.error);
        }
      });
    }
  } catch (error) {
    console.error('Error sending push notifications for new post:', error);
  }
}

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      content: newPostData.content,
      latitude: newPostData.latitude,
      longitude: newPostData.longitude,
      mediaurl: newPostData.mediaUrl,
      mediatype: newPostData.mediaType,
      hashtags: newPostData.hashtags || [], 
      city: cityName,
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    const addedPostClient: Post = {
        ...addedPostDb,
        createdAt: addedPostDb.createdat,
        likeCount: addedPostDb.likecount,
        mediaUrl: addedPostDb.mediaurl,
        mediaType: addedPostDb.mediatype,
        hashtags: addedPostDb.hashtags || [],
    };
    
    revalidatePath('/'); // This might not be strictly necessary if client updates optimistically and via polling
    
    sendNotificationsForNewPost(addedPostClient).catch(err => {
      console.error("Background notification sending failed:", err);
    });

    return { post: addedPostClient };
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
      return {
        post: {
          ...updatedPost,
          createdAt: updatedPost.createdat,
          likeCount: updatedPost.likecount,
          mediaUrl: updatedPost.mediaurl,
          mediaType: updatedPost.mediatype,
          hashtags: updatedPost.hashtags || [],
        }
      };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    console.error(`Server action error toggling like for post ${postId}:`, error);
    return { error: error.message || `Failed to update like count for post ${postId} due to a server error.` };
  }
}


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
    if (latestPostIdClientKnows === 0) { // If client knows no posts, assume any post is new
        const anyPosts = await db.getPostsDb(); // Check if any posts exist
        return { hasNewerPosts: anyPosts.length > 0, count: anyPosts.length };
    }
    const count = await db.getNewerPostsCountDb(latestPostIdClientKnows);
    return { hasNewerPosts: count > 0, count };
  } catch (error) {
    console.error("Server action error checking for newer posts:", error);
    return { hasNewerPosts: false, count: 0 };
  }
}

