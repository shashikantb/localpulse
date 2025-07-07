
'use server';

import * as db from '@/lib/db';
import type { Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts, User, UserFollowStats, FollowUser, UserWithStatuses, NewStatus, FamilyMember, FamilyMemberLocation, PendingFamilyRequest, Conversation, Message, ConversationParticipant } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { admin as firebaseAdmin } from '@/lib/firebase-admin';
import { getSession } from '@/app/auth/actions';
import { getGcsClient, getGcsBucketName } from '@/lib/gcs';
import { redirect } from 'next/navigation';


async function geocodeCoordinates(latitude: number, longitude: number): Promise<string | null> {
  // ... (existing geocode placeholder logic)
  if (latitude > 40.5 && latitude < 40.9 && longitude > -74.3 && longitude < -73.7) return "New York";
  if (latitude > 33.8 && latitude < 34.2 && longitude > -118.5 && longitude < -118.0) return "Los Angeles";
  if (latitude > 51.3 && latitude < 51.7 && longitude > -0.5 && longitude < 0.3) return "London";
  if (latitude > 35.5 && latitude < 35.9 && longitude > 139.5 && longitude < 139.9) return "Tokyo";
  return "Unknown City";
}

// The mapPostFromDb function is no longer needed as sanitization happens at the DB query level.

export async function getPosts(options?: { page: number; limit: number; latitude?: number | null; longitude?: number | null; }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        latitude: options.latitude,
        longitude: options.longitude
    } : { limit: 10, offset: 0 };

    let posts = await db.getPostsDb(dbOptions, user?.role);
    
    if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const authorIds = [...new Set(posts.map(p => p.authorid).filter((id): id is number => id !== null))];

        const [likedPostIds, mentionsMap, followedAuthorIds] = await Promise.all([
            user ? db.getLikedPostIdsForUserDb(user.id, postIds) : Promise.resolve(new Set<number>()),
            db.getMentionsForPostsDb(postIds),
            (user && authorIds.length > 0) ? db.getFollowedUserIdsDb(user.id, authorIds) : Promise.resolve(new Set<number>())
        ]);

        posts.forEach((post: any) => {
            post.isLikedByCurrentUser = likedPostIds.has(post.id);
            post.mentions = mentionsMap.get(post.id) || [];
            post.isAuthorFollowedByCurrentUser = followedAuthorIds.has(post.authorid);
        });
    }
    
    return posts;
  } catch (error: any) {
    console.error("Server action error fetching posts:", error.message);
    // In production, we don't want to throw an error to the client here.
    // Instead, we return an empty array and the client will show cached data or an empty state.
    return [];
  }
}

export async function getAdminPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit
    } : undefined;

    let posts = await db.getPostsDb(dbOptions);
    
    if (posts.length > 0) {
      const mentionsMap = await db.getMentionsForPostsDb(posts.map(p => p.id));
      posts.forEach((post: any) => {
        post.mentions = mentionsMap.get(post.id) || [];
      });
    }
    
    return posts;
  } catch (error) {
    console.error("Server action error fetching admin posts:", error);
    return [];
  }
}


export async function getMediaPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? { limit: options.limit, offset: (options.page - 1) * options.limit } : undefined;
    
    let posts = await db.getMediaPostsDb(dbOptions);

    if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const authorIds = [...new Set(posts.map(p => p.authorid).filter((id): id is number => id !== null))];

        const [likedPostIds, mentionsMap, followedAuthorIds] = await Promise.all([
            user ? db.getLikedPostIdsForUserDb(user.id, postIds) : Promise.resolve(new Set<number>()),
            db.getMentionsForPostsDb(postIds),
            (user && authorIds.length > 0) ? db.getFollowedUserIdsDb(user.id, authorIds) : Promise.resolve(new Set<number>())
        ]);
        
        posts.forEach((post: any) => {
            post.isLikedByCurrentUser = likedPostIds.has(post.id);
            post.mentions = mentionsMap.get(post.id) || [];
            post.isAuthorFollowedByCurrentUser = followedAuthorIds.has(post.authorid);
        });
    }

    return posts;
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

    const notificationPayload = {
        title: `New Pulse Nearby from ${authorDisplayName}!`,
        body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
    };

    // 1. Send notifications to mentioned users
    if (mentionedUserIds.length > 0) {
        const mentionedTokens = await db.getDeviceTokensForUsersDb(mentionedUserIds);
        if (mentionedTokens.length > 0) {
            mentionedTokens.forEach(t => processedTokens.add(t));
            const message = {
                notification: {
                  ...notificationPayload,
                  title: `${authorDisplayName} mentioned you in a pulse!`,
                },
                data: {
                    postId: String(post.id)
                },
                tokens: mentionedTokens,
                android: {
                  priority: 'high' as const,
                },
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
            notification: notificationPayload,
            data: {
                postId: String(post.id)
            },
            tokens: nearbyOnlyTokens,
            android: {
              priority: 'high' as const,
            },
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

async function sendNotificationForNewComment(comment: Comment, post: Post) {
  try {
    // Basic checks: ensure there is a post author and the commenter is not the author
    if (!post.authorid) return;
    
    const { user: commenterUser } = await getSession();
    if (commenterUser && commenterUser.id === post.authorid) {
      return; // Don't send notifications for own comments
    }

    // Fetch the post author's device tokens
    const authorDeviceTokens = await db.getDeviceTokensForUsersDb([post.authorid]);
    if (authorDeviceTokens.length === 0) return;

    // Construct and send the notification
    const notificationPayload = {
      notification: {
        title: `${comment.author} commented on your pulse`,
        body: comment.content.length > 100 ? `${comment.content.substring(0, 97)}...` : comment.content,
      },
      data: {
        postId: String(post.id),
      },
      tokens: authorDeviceTokens,
      android: {
        priority: 'high' as const,
      },
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(notificationPayload);

    // Clean up any failed tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(authorDeviceTokens[idx]);
        }
      });
      console.error('List of tokens that failed for new comment notification:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending new comment notification:', error);
  }
}

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession(); // user can be null

    if (newPostData.authorId && (!user || user.id !== newPostData.authorId)) {
        return { error: 'Authentication mismatch. You can only post for yourself.' };
    }
    
    let mediaUrls = newPostData.mediaUrls;
    let mediaType = newPostData.mediaType;
    let content = newPostData.content;
    
    // If no media file was uploaded, check the text content for a YouTube link.
    if (!mediaUrls || mediaUrls.length === 0) {
      // This regex is now more robust, handling various URL formats and query parameters.
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})(?:\S+)?/
      const match = content.match(urlRegex);

      if (match) {
          const youtubeId = match[1];   // The 11-character video ID is always in the first capturing group.
          const urlToRemove = match[0]; // The full matched URL.

          mediaUrls = [`https://www.youtube.com/embed/${youtubeId}`];
          mediaType = 'video';
          // Replace only the first occurrence of the URL to be safe, then trim whitespace.
          content = content.replace(urlToRemove, '').trim();
      }
    }

    const cityName = await geocodeCoordinates(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      content: content, // Use potentially modified content
      latitude: newPostData.latitude,
      longitude: newPostData.longitude,
      mediaurls: mediaUrls,
      mediatype: mediaType,
      hashtags: newPostData.hashtags || [], 
      city: cityName,
      authorid: user ? user.id : null,
      mentionedUserIds: newPostData.mentionedUserIds || [],
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    
    const finalPost = await db.getPostByIdDb(addedPostDb.id);

    if (!finalPost) {
        return { error: 'Failed to retrieve post after creation.' };
    }

    revalidatePath('/');
    
    sendNotificationsForNewPost(finalPost, postDataForDb.mentionedUserIds).catch(err => {
      console.error("Background notification sending failed:", err);
    });

    return { post: finalPost };
  } catch (error: any) {
    console.error("Server action error adding post:", error);
    return { error: error.message || 'Failed to add post due to an unknown server error.' };
  }
}

export async function deleteUserPost(postId: number): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to delete a post.' };
  }

  const postToDelete = await db.getPostByIdDb(postId);
  if (!postToDelete) {
    return { success: false, error: 'Post not found.' };
  }

  if (postToDelete.authorid !== user.id) {
    return { success: false, error: 'You are not authorized to delete this post.' };
  }

  try {
    await db.deletePostDb(postId);
    revalidatePath('/');
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting post:', error);
    return { success: false, error: 'Failed to delete post due to a server error.' };
  }
}

export async function getSignedUploadUrl(fileName: string, fileType: string): Promise<{ success: boolean; error?: string; uploadUrl?: string; publicUrl?: string }> {
  const storage = getGcsClient();
  const bucketName = getGcsBucketName();

  if (!storage || !bucketName) {
    return { success: false, error: 'Google Cloud Storage is not configured on the server.' };
  }
  
  // Make filename unique to avoid collisions, using built-in methods
  const randomString = Math.random().toString(36).substring(2, 11);
  const uniqueFileName = `${Date.now()}-${randomString}-${fileName.replace(/\s/g, '_')}`;


  const file = storage.bucket(bucketName).file(uniqueFileName);

  const options = {
    version: 'v4' as const,
    action: 'write' as const,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: fileType,
  };

  try {
    const [uploadUrl] = await file.getSignedUrl(options);
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`;
    
    return { success: true, uploadUrl, publicUrl };
  } catch (error: any) {
    console.error('Error getting signed URL:', error);
    return { success: false, error: 'Could not get a file upload URL.' };
  }
}

export async function uploadGeneratedImage(dataUrl: string, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  const storage = getGcsClient();
  const bucketName = getGcsBucketName();

  if (!storage || !bucketName) {
    return { success: false, error: 'Google Cloud Storage is not configured on the server.' };
  }

  try {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: 'Invalid data URL format.' };
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a unique filename to avoid collisions
    const uniqueFileName = `${user.id}-${Date.now()}-${fileName}`;

    const file = storage.bucket(bucketName).file(uniqueFileName);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
      public: true, // Make the file publicly readable
    });
    
    // The public URL for a publicly accessible object
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`;

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('Error uploading generated image to GCS:', error);
    return { success: false, error: 'Failed to upload image due to a server error.' };
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
      updatedPost.isLikedByCurrentUser = !hasLiked;
      return { post: updatedPost };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error toggling like for post ${postId}:`, error.message);
    return { error: 'Failed to update like count due to a server error.' };
  }
}

export async function likePostAnonymously(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    // For anonymous users, we just increment the count. We can't toggle.
    const updatedPost = await db.updatePostLikeCountDb(postId, 'increment');
    
    if (updatedPost) {
      revalidatePath('/'); 
      revalidatePath(`/posts/${postId}`);
      return { post: updatedPost };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error liking post ${postId} anonymously:`, error.message);
    return { error: 'Failed to update like count due to a server error.' };
  }
}


export async function addComment(commentData: NewComment): Promise<{ comment?: Comment; error?: string }> {
  try {
    const { user } = await getSession();
    const authorName = user ? user.name : 'PulseFan';
    
    const addedComment = await db.addCommentDb({ ...commentData, author: authorName });

    // Fetch the post to notify its author
    const post = await db.getPostByIdDb(commentData.postId);
    if (post) {
      // Don't block the client response, run notification in the background
      sendNotificationForNewComment(addedComment, post).catch(err => {
        console.error("Background task to send comment notification failed:", err);
      });
    }

    revalidatePath('/');
    revalidatePath(`/posts/${commentData.postId}`);
    revalidatePath(`/chat`);
    return { comment: addedComment };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error adding comment to post ${commentData.postId}:`, error.message);
    return { error: 'Failed to add comment due to a server error.' };
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
    console.error(`Server action error recording view for post ${postId}:`, error);
    return { success: false };
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
    const { user } = await getSession(); // Get user from session to associate token
    await db.addOrUpdateDeviceTokenDb(token, latitude, longitude, user?.id);
    return { success: true };
  } catch (error: any) {
    console.error('Server action error registering device token:', error);
    return { success: false, error: error.message || 'Failed to register device token.' };
  }
}

export async function updateUserLocation(latitude?: number, longitude?: number): Promise<void> {
    if (latitude === undefined || longitude === undefined) return;
    try {
        const { user } = await getSession();
        if (user) {
            await db.updateUserLocationDb(user.id, latitude, longitude);
        }
    } catch (error: any) {
        // Fail silently
        console.error('Failed to update user location in background:', error.message);
    }
}


export async function checkForNewerPosts(latestPostIdClientKnows: number): Promise<{ hasNewerPosts: boolean; count: number }> {
  try {
    // If the client doesn't know about any posts yet (e.g., initial load),
    // there are no "newer" posts to show. The initial fetch will get the latest ones.
    if (latestPostIdClientKnows === 0) {
        return { hasNewerPosts: false, count: 0 };
    }
    const count = await db.getNewerPostsCountDb(latestPostIdClientKnows);
    return { hasNewerPosts: count > 0, count };
  } catch (error) {
    console.error("Server action error checking for newer posts:", error);
    return { hasNewerPosts: false, count: 0 };
  }
}

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
    
    if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const authorIds = [...new Set(posts.map(p => p.authorid).filter((id): id is number => id !== null))];

        const [likedPostIds, mentionsMap, followedAuthorIds] = await Promise.all([
            sessionUser ? db.getLikedPostIdsForUserDb(sessionUser.id, postIds) : Promise.resolve(new Set<number>()),
            db.getMentionsForPostsDb(postIds),
            (sessionUser && authorIds.length > 0) ? db.getFollowedUserIdsDb(sessionUser.id, authorIds) : Promise.resolve(new Set<number>())
        ]);

        posts.forEach((post: any) => {
            post.isLikedByCurrentUser = likedPostIds.has(post.id);
            post.mentions = mentionsMap.get(post.id) || [];
            post.isAuthorFollowedByCurrentUser = followedAuthorIds.has(post.authorid);
        });
    }
    
    return posts;
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

    if (post) {
        const postIds = [post.id];
        const authorIds = post.authorid ? [post.authorid] : [];
        const [likedPostIds, mentionsMap, followedAuthorIds] = await Promise.all([
            user ? db.getLikedPostIdsForUserDb(user.id, postIds) : Promise.resolve(new Set<number>()),
            db.getMentionsForPostsDb(postIds),
            (user && authorIds.length > 0) ? db.getFollowedUserIdsDb(user.id, authorIds) : Promise.resolve(new Set<number>())
        ]);
        
        (post as any).isLikedByCurrentUser = likedPostIds.has(post.id);
        (post as any).mentions = mentionsMap.get(post.id) || [];
        (post as any).isAuthorFollowedByCurrentUser = followedAuthorIds.has(post.authorid);
    }

    return post;
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

  // Sanitization is now handled by the DB query.

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

export async function getFollowingList(userId: number): Promise<FollowUser[]> {
  try {
    return await db.getFollowingListDb(userId);
  } catch (error) {
    console.error(`Error fetching following list for user ${userId}:`, error);
    return [];
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

// --- Status (Story) Actions ---

export async function addStatus(mediaUrl: string, mediaType: 'image' | 'video'): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to post a status.' };
  }
  
  try {
    const newStatus: NewStatus = {
      userId: user.id,
      mediaUrl,
      mediaType,
    };
    await db.addStatusDb(newStatus);
    revalidatePath('/'); // Revalidate home page to show new status
    return { success: true };
  } catch (error: any) {
    console.error('Error adding status:', error);
    return { success: false, error: error.message || 'Failed to post status.' };
  }
}

export async function getStatusesForFeed(): Promise<UserWithStatuses[]> {
  const { user } = await getSession();
  if (!user) {
    return [];
  }
  
  try {
    return await db.getStatusesForFeedDb(user.id);
  } catch (error) {
    console.error('Error fetching statuses for feed:', error);
    return [];
  }
}

// --- Family Relationship Actions ---

export async function getFamilyRelationshipStatus(sessionUser: User | null, targetUserId: number): Promise<{ status: 'none' | 'pending_from_me' | 'pending_from_them' | 'approved' }> {
  if (!sessionUser || sessionUser.id === targetUserId) {
    return { status: 'none' };
  }

  try {
    const relationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
    if (!relationship) {
      return { status: 'none' };
    }

    if (relationship.status === 'approved') {
      return { status: 'approved' };
    }

    if (relationship.status === 'pending') {
      if (relationship.requester_id === sessionUser.id) {
        return { status: 'pending_from_me' };
      } else {
        return { status: 'pending_from_them' };
      }
    }
    
    // 'rejected' status is treated as 'none' for a new request
    return { status: 'none' }; 
  } catch (error) {
    console.error(`Error fetching family relationship status for user ${targetUserId}:`, error);
    return { status: 'none' };
  }
}

export async function sendFamilyRequest(targetUserId: number): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in to send a request.' };
  }
  if (sessionUser.id === targetUserId) {
    return { success: false, error: 'You cannot add yourself as family.' };
  }

  try {
    const existingRelationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
    if (existingRelationship && existingRelationship.status !== 'rejected') {
        return { success: false, error: 'A request already exists or you are already family members.' };
    }
    
    await db.sendFamilyRequestDb(sessionUser.id, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send request.' };
  }
}

export async function cancelFamilyRequest(targetUserId: number): Promise<{ success: boolean; error?: string }> {
    const { user: sessionUser } = await getSession();
    if (!sessionUser) {
        return { success: false, error: 'You must be logged in.' };
    }

    try {
        const relationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
        if (!relationship || relationship.status !== 'pending' || relationship.requester_id !== sessionUser.id) {
            return { success: false, error: 'No pending request found to cancel.' };
        }
        await db.deleteFamilyRelationshipDb(relationship.id);
        revalidatePath(`/users/${targetUserId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to cancel request.' };
    }
}


export async function respondToFamilyRequest(otherUserId: number, response: 'approve' | 'reject'): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in.' };
  }

  try {
    const relationship = await db.getFamilyRelationshipDb(sessionUser.id, otherUserId);

    if (!relationship || relationship.status !== 'pending' || relationship.requester_id === sessionUser.id) {
        return { success: false, error: 'No pending request found from this user.' };
    }
    
    if (response === 'approve') {
        await db.updateFamilyRequestStatusDb(relationship.id, 'approved');
    } else {
        // If rejected, we'll just delete the request to allow for a new one in the future.
        await db.deleteFamilyRelationshipDb(relationship.id);
    }
    
    revalidatePath(`/users/${otherUserId}`);
    revalidatePath(`/users/${sessionUser.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to respond to request.' };
  }
}

export async function getFamilyMembers(userId: number): Promise<FamilyMember[]> {
    try {
        return await db.getFamilyMembersForUserDb(userId);
    } catch (error) {
        console.error(`Error fetching family members for user ${userId}:`, error);
        return [];
    }
}

export async function getPendingFamilyRequests(): Promise<PendingFamilyRequest[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getPendingFamilyRequestsForUserDb(user.id);
    } catch (error) {
        console.error(`Error fetching pending family requests for user ${user.id}:`, error);
        return [];
    }
}

export async function toggleLocationSharing(targetUserId: number, share: boolean): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in.' };
  }
  
  try {
    await db.toggleLocationSharingDb(sessionUser.id, targetUserId, share);
    revalidatePath(`/users/${sessionUser.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error toggling location sharing for user ${targetUserId}:`, error);
    return { success: false, error: 'An unexpected server error occurred.' };
  }
}

export async function getFamilyLocations(): Promise<FamilyMemberLocation[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getFamilyLocationsForUserDb(user.id);
    } catch (error) {
        console.error(`Error fetching family locations for user ${user.id}:`, error);
        return [];
    }
}


// --- Chat Actions ---

export async function startChatAndRedirect(formData: FormData): Promise<void> {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
  }

  const otherUserIdRaw = formData.get('otherUserId');
  if (!otherUserIdRaw) {
    console.error("startChatAndRedirect: otherUserId is missing from form data.");
    return;
  }
  
  const otherUserId = parseInt(otherUserIdRaw as string, 10);
  if (isNaN(otherUserId) || otherUserId === user.id) {
    return;
  }
  
  const conversationId = await db.findOrCreateConversationDb(user.id, otherUserId);
  
  revalidatePath('/chat');
  redirect(`/chat/${conversationId}`);
}

export async function getConversations(): Promise<Conversation[]> {
  const { user } = await getSession();
  if (!user) return [];
  try {
    return await db.getConversationsForUserDb(user.id);
  } catch (error) {
    console.error("Server action error fetching conversations:", error);
    return [];
  }
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const { user } = await getSession();
  if (!user) return [];
  try {
    // This check is now performed inside the DB function
    return await db.getMessagesForConversationDb(conversationId, user.id);
  } catch (error) {
    console.error(`Server action error fetching messages for conversation ${conversationId}:`, error);
    return [];
  }
}

async function sendChatNotification(conversationId: number, sender: User, content: string, title?: string) {
  try {
    const partner = await db.getConversationPartnerDb(conversationId, sender.id);
    if (!partner) return;

    const deviceTokens = await db.getDeviceTokensForUsersDb([partner.id]);
    if (deviceTokens.length === 0) return;

    const notificationPayload = {
      notification: {
        title: title || `New message from ${sender.name}`,
        body: content.length > 100 ? `${content.substring(0, 97)}...` : content,
      },
      data: {
        conversationId: String(conversationId),
        type: 'chat_message',
      },
      tokens: deviceTokens,
      android: {
        priority: 'high' as const,
      },
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(notificationPayload);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(deviceTokens[idx]);
        }
      });
      console.error('List of tokens that failed for chat notification:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending chat notification:', error);
  }
}

export async function sendMessage(conversationId: number, content: string): Promise<{ message?: Message; error?: string }> {
  const { user } = await getSession();
  if (!user) return { error: 'You must be logged in to send messages.' };

  try {
    const message = await db.addMessageDb({
      conversationId,
      senderId: user.id,
      content,
    });
    
    // Send notification in the background with the default title
    sendChatNotification(conversationId, user, content).catch(err => {
        console.error("Background task to send chat notification failed:", err);
    });

    revalidatePath(`/chat/${conversationId}`);
    revalidatePath('/chat'); // To update the sidebar
    return { message };
  } catch (error: any) {
    return { error: 'Failed to send message due to a server error.' };
  }
}

export async function sendSosMessage(latitude: number, longitude: number): Promise<{ success: boolean; error?: string; message?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to send an SOS.' };
  }

  try {
    const recipients = await db.getRecipientsForSosDb(user.id);
    if (recipients.length === 0) {
      return { success: false, error: 'You are not sharing your location with any family members. SOS not sent.' };
    }

    const sosMessageContent = `🔴 SOS EMERGENCY ALERT 🔴\nFrom: ${user.name}\nMy current location is: https://www.google.com/maps?q=${latitude},${longitude}`;
    const notificationTitle = `🔴 SOS from ${user.name}`;
    
    let sentCount = 0;
    for (const recipient of recipients) {
      const conversationId = await db.findOrCreateConversationDb(user.id, recipient.id);
      
      // Directly add message to DB
      await db.addMessageDb({
          conversationId,
          senderId: user.id,
          content: sosMessageContent,
      });

      // Directly send notification with custom title
      sendChatNotification(conversationId, user, sosMessageContent, notificationTitle).catch(err => {
          console.error("Background task to send SOS chat notification failed:", err);
      });
      
      sentCount++;
    }
    
    revalidatePath('/chat', 'layout'); // Use layout revalidation to update sidebar and unread counts
    return { success: true, message: `SOS alert sent to ${sentCount} family member(s).` };

  } catch (error: any) {
    console.error('Error sending SOS message:', error);
    return { success: false, error: 'Failed to send SOS message due to a server error.' };
  }
}


export async function getConversationPartner(conversationId: number, currentUserId: number): Promise<ConversationParticipant | null> {
    try {
        return await db.getConversationPartnerDb(conversationId, currentUserId);
    } catch (error) {
        console.error(`Server action error fetching partner for conversation ${conversationId}:`, error);
        return null;
    }
}

export async function getUnreadMessageCount(): Promise<number> {
    const { user } = await getSession();
    if (!user) return 0;
    try {
        return await db.getTotalUnreadMessagesDb(user.id);
    } catch (error) {
        console.error("Server action error fetching unread message count:", error);
        return 0;
    }
}

export async function markConversationAsRead(conversationId: number): Promise<void> {
    const { user } = await getSession();
    if (!user) return;
    try {
        await db.markConversationAsReadDb(conversationId, user.id);
        revalidatePath('/chat'); // Revalidate sidebar and nav badge
    } catch (error) {
        console.error(`Server action error marking conversation ${conversationId} as read:`, error);
    }
}
