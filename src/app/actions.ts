
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';

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

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      content: newPostData.content,
      latitude: newPostData.latitude,
      longitude: newPostData.longitude,
      mediaurl: newPostData.mediaUrl,
      mediatype: newPostData.mediaType,
      hashtags: newPostData.hashtags,
      city: cityName,
    };

    const addedPost = await db.addPostDb(postDataForDb);
    revalidatePath('/');
    return {
        post: {
          ...addedPost,
          createdAt: addedPost.createdat,
          likeCount: addedPost.likecount,
          mediaUrl: addedPost.mediaurl,
          mediaType: addedPost.mediatype,
          hashtags: addedPost.hashtags || [],
        }
    };
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
    console.error(`Server action error liking post ${postId}:`, error);
    return { error: error.message || `Failed to like post ${postId} due to a server error.` };
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
