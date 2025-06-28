
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts, User, UserFollowStats } from '@/lib/db-types';
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

async function attachMentions(posts: Post[]): Promise<Post[]> {
  const postIds = posts.map(p => p.id);
  if (postIds.length > 0) {
    const mentionsMap = await db.getMentionsForPostsDb(postIds);
    posts.forEach(post => {
      post.mentions = mentionsMap.get(post.id) || [];
    });
  }
  return posts;
}

// Helper to attach like status to posts for a logged-in user
async function attachLikeStatus(posts: Post[], user: User | null): Promise<Post[]> {
    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const likedPostIds = await db.getLikedPostIdsForUserDb(user.id, postIds);
      posts.forEach(post => {
        post.isLikedByCurrentUser = likedPostIds.has(post.id);
      });
    }
    return posts;
}

const mapPostFromDb = (post: Post) => ({
    ...post,
    createdAt: post.createdat,
    likeCount: post.likecount,
    notifiedCount: post.notifiedcount,
    viewCount: post.viewcount,
    mediaUrl: post.mediaurl,
    mediaType: post.mediatype,
    hashtags: post.hashtags || [],
    authorId: post.authorid,
    authorName: post.authorname,
    authorRole: post.authorrole,
    mentions: post.mentions || [],
});


export async function getPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit
    } : undefined;

    let posts = await db.getPostsDb(dbOptions, user?.role);
    posts = await attachLikeStatus(posts, user);
    posts = await attachMentions(posts);
    
    return posts.map(mapPostFromDb);
  } catch (error) {
    console.error("Server action error fetching posts:", error);
    return [];
  }
}

export async function getMediaPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? { limit: options.limit, offset: (options.page - 1) * options.limit } : undefined;
    
    let posts = await db.getMediaPostsDb(dbOptions);
    posts = await attachLikeStatus(posts, user);
    posts = await attachMentions(posts);

    return posts.map(mapPostFromDb);
  } catch (error) {
    console.error("Server action error fetching media posts:", error);
    return [];
  }
}

async function sendNotificationsForNewPost(post: Post, mentionedUserIds: number[] = []) {
  try {
    let successCount = 0;
    const failedTokens: string[] = [];
    const processedTokens = new Set<string>();
    const authorDisplayName = post.authorname || 'an Anonymous Pulsar';

    // 1. Send notifications to mentioned users
    if (mentionedUserIds.length > 0) {
        const mentionedTokens = await db.getDeviceTokensForUsersDb(mentionedUserIds);
        if (mentionedTokens.length > 0) {
            mentionedTokens.forEach(t => processedTokens.add(t));
            const message = {
                notification: {
                    title: `${authorDisplayName} mentioned you in a pulse!`,
                    body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
                },
                tokens: mentionedTokens,
            };
            const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
            successCount += response.successCount;
            response.responses.forEach((resp, idx) => {
                if (!resp.success) failedTokens.push(mentionedTokens[idx]);
            });
        }
    }

    // 2. Send notifications to nearby users (who were not already notified via mention)
    const nearbyTokens = await db.getNearbyDeviceTokensDb(post.latitude, post.longitude, 20); // 20km radius
    const nearbyOnlyTokens = nearbyTokens.filter(t => !processedTokens.has(t));
    if (nearbyOnlyTokens.length > 0) {
        const message = {
            notification: {
                title: `New Pulse Nearby from ${authorDisplayName}!`,
                body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            },
            tokens: nearbyOnlyTokens,
        };
        const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
        successCount += response.successCount;
        response.responses.forEach((resp, idx) => {
            if (!resp.success) failedTokens.push(nearbyOnlyTokens[idx]);
        });
    }

    // 3. Update notification count and clean up failed tokens
    if (successCount > 0) {
      await db.updateNotifiedCountDb(post.id, successCount);
    }
    
    if (failedTokens.length > 0) {
      console.error('List of tokens that caused failures:', failedTokens);
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
      mentionedUserIds: newPostData.mentionedUserIds || [],
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    
    // Fetch the full post details, including joined author info
    const allPosts = await db.getPostsDb(undefined, user?.role);
    const finalPost = allPosts.find(p => p.id === addedPostDb.id);


    if (!finalPost) {
        return { error: 'Failed to retrieve post after creation.' };
    }

    revalidatePath('/');
    
    // Always send notifications for any new post, including to mentioned users
    sendNotificationsForNewPost(finalPost, postDataForDb.mentionedUserIds).catch(err => {
      console.error("Background notification sending failed:", err);
    });

    return { post: finalPost };
  } catch (error: any) {
    console.error("Server action error adding post:", error);
    return { error: error.message || 'Failed to add post due to an unknown server error.' };
  }
}


export async function toggleLikePost(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession();
    if (!user) {
      return { error: 'You must be logged in to like a post.' };
    }

    const hasLiked = await db.checkIfUserLikedPostDb(user.id, postId);
    let updatedPost: Post | null;

    if (hasLiked) {
      await db.removeLikeDb(user.id, postId);
      updatedPost = await db.updatePostLikeCountDb(postId, 'decrement');
    } else {
      await db.addLikeDb(user.id, postId);
      updatedPost = await db.updatePostLikeCountDb(postId, 'increment');
    }
    
    if (updatedPost) {
      revalidatePath('/'); 
      revalidatePath(`/posts/${postId}`);
      // Manually set the isLikedByCurrentUser flag for the response
      const finalPost = mapPostFromDb(updatedPost);
      finalPost.isLikedByCurrentUser = !hasLiked;
      return { post: finalPost };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    console.error(`Server action error toggling like for post ${postId}:`, error);
    return { error: error.message || `Failed to update like count for post ${postId} due to a server error.` };
  }
}

export async function likePostAnonymously(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    // For anonymous users, we just increment the count. We can't toggle.
    const updatedPost = await db.updatePostLikeCountDb(postId, 'increment');
    
    if (updatedPost) {
      revalidatePath('/'); 
      revalidatePath(`/posts/${postId}`);
      return { post: mapPostFromDb(updatedPost) };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    console.error(`Server action error liking post ${postId} anonymously:`, error);
    return { error: error.message || `Failed to update like count for post ${postId} due to a server error.` };
  }
}


export async function addComment(commentData: NewComment): Promise<Comment> {
  try {
    const { user } = await getSession();
    const authorName = user ? user.name : 'PulseFan';
    
    const addedComment = await db.addCommentDb({ ...commentData, author: authorName });
    revalidatePath('/');
    revalidatePath(`/posts/${commentData.postId}`);
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

export async function recordPostView(postId: number): Promise<{ success: boolean }> {
  try {
    await db.incrementPostViewCountDb(postId);
    return { success: true };
  } catch (error) {
    // Log but don't surface to the user, it's a background task.
    console.error(`Server action error recording view for post ${postId}:`, error);
    return { success: false };
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
    const { user } = await getSession(); // Get user from session to associate token
    await db.addOrUpdateDeviceTokenDb(token, latitude, longitude, user?.id);
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

// New actions for user profile pages
export async function getUser(userId: number): Promise<User | null> {
    try {
        const user = await db.getUserByIdDb(userId);
        return user;
    } catch (error) {
        console.error(`Server action error fetching user ${userId}:`, error);
        return null;
    }
}

export async function getPostsByUserId(userId: number): Promise<Post[]> {
  try {
    const { user: sessionUser } = await getSession();
    let posts = await db.getPostsByUserIdDb(userId);
    posts = await attachLikeStatus(posts, sessionUser);
    posts = await attachMentions(posts);
    
    return posts.map(mapPostFromDb);
  } catch (error) {
    console.error(`Server action error fetching posts for user ${userId}:`, error);
    return [];
  }
}

export async function getPostById(postId: number): Promise<Post | null> {
  try {
    const { user } = await getSession();
    let post = await db.getPostByIdDb(postId, user?.role);
    if (!post) return null;

    let posts = [post];
    posts = await attachLikeStatus(posts, user);
    posts = await attachMentions(posts);

    return mapPostFromDb(posts[0]);
  } catch (error) {
    console.error(`Server action error fetching post ${postId}:`, error);
    return null;
  }
}


// --- Follower Actions ---

export async function getUserWithFollowInfo(profileUserId: number): Promise<{ user: User | null; stats: UserFollowStats; isFollowing: boolean }> {
  const { user: sessionUser } = await getSession();
  
  const [profileUser, stats] = await Promise.all([
    db.getUserByIdDb(profileUserId),
    db.getFollowerCountsDb(profileUserId),
  ]);

  if (!profileUser) {
    return { user: null, stats: { followerCount: 0, followingCount: 0 }, isFollowing: false };
  }

  let isFollowing = false;
  if (sessionUser && sessionUser.id !== profileUserId) {
    isFollowing = await db.checkIfUserIsFollowingDb(sessionUser.id, profileUserId);
  }

  return { user: profileUser, stats, isFollowing };
}

export async function toggleFollow(targetUserId: number): Promise<{ success: boolean; isFollowing?: boolean; error?: string; }> {
  const { user: sessionUser } = await getSession();
  
  if (!sessionUser) {
    return { success: false, error: "You must be logged in to follow users." };
  }
  
  if (sessionUser.id === targetUserId) {
    return { success: false, error: "You cannot follow yourself." };
  }

  try {
    const isCurrentlyFollowing = await db.checkIfUserIsFollowingDb(sessionUser.id, targetUserId);

    if (isCurrentlyFollowing) {
      await db.unfollowUserDb(sessionUser.id, targetUserId);
    } else {
      await db.followUserDb(sessionUser.id, targetUserId);
    }
    
    revalidatePath(`/users/${targetUserId}`);
    return { success: true, isFollowing: !isCurrentlyFollowing };

  } catch (error: any) {
    console.error(`Error toggling follow for user ${targetUserId}:`, error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

// --- Mention Actions ---
export async function searchUsers(query: string): Promise<User[]> {
  const { user } = await getSession();
  if (!query) return [];
  try {
    return await db.searchUsersDb(query, user?.id);
  } catch (error) {
    console.error("Server action error searching users:", error);
    return [];
  }
}
