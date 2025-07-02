
export type UserRole = 'Business' | 'Gorakshak' | 'Admin' | 'Public(जनता)';

// Define the structure of a User for client-side use (omitting password)
export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  createdat: string;
  profilepictureurl?: string | null;
}

// For displaying in the following list
export interface FollowUser {
    id: number;
    name: string;
    profilepictureurl?: string | null;
}

// Full user structure from DB, including password hash
export interface UserWithPassword extends User {
  passwordhash: string;
}

// For creating a new user
export type NewUser = {
  name: string;
  email: string;
  role: 'Business' | 'Gorakshak' | 'Public(जनता)';
  passwordplaintext: string;
};

// For updating a user from the admin panel
export type UpdatableUserFields = {
  name: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
};


// Define the structure of a Post, now with author details
export interface Post {
  id: number;
  content: string;
  latitude: number;
  longitude: number;
  createdat: string;
  mediaurls?: string[] | null;
  mediatype?: 'image' | 'video' | 'gallery' | null;
  likecount: number;
  commentcount: number;
  notifiedcount: number;
  viewcount: number;
  city?: string | null;
  hashtags?: string[] | null;
  authorid: number | null; // This will come from the posts table
  authorname: string | null; // This will be joined from the users table
  authorrole: UserRole | null; // This will be joined from the users table
  authorprofilepictureurl?: string | null; // This will be joined from the users table
  isLikedByCurrentUser?: boolean; // Added to track if the session user liked this post
  mentions?: { id: number; name: string; }[];
}

// For creating a new post from the client
export type NewPost = {
  content: string;
  latitude: number;
  longitude: number;
  mediaUrls?: string[] | null; // The final GCS URLs
  mediaType?: 'image' | 'video' | 'gallery' | null;
  hashtags: string[];
  authorId?: number;
  mentionedUserIds?: number[];
};

// For inserting a new post into the DB
export type DbNewPost = {
  content: string;
  latitude: number;
  longitude: number;
  mediaurls?: string[] | null;
  mediatype?: 'image' | 'video' | 'gallery' | null;
  city?: string | null;
  hashtags: string[];
  authorid: number | null; 
  mentionedUserIds?: number[];
};


// Define the structure of a Comment
export interface Comment {
  id: number;
  postid: number;
  author: string; // For now, can be user name or default
  content: string;
  createdat: string;
}

// Define the structure for adding a new comment
export type NewComment = {
  postId: number;
  author: string;
  content: string;
};

// Visitor stats structure
export interface VisitorCounts {
  totalVisits: number;
  dailyVisits: number;
}

// Device token structure for FCM
export interface DeviceToken {
  id: number;
  token: string;
  latitude: number | null;
  longitude: number | null;
  last_updated: string;
}

// User follow stats structure
export interface UserFollowStats {
  followerCount: number;
  followingCount: number;
}
