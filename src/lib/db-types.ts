
export type UserRole = 'Business' | 'Gorakshak' | 'Admin';

// Define the structure of a User for client-side use (omitting password)
export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  createdat: string;
}

// Full user structure from DB, including password hash
export interface UserWithPassword extends User {
  passwordhash: string;
}

// For creating a new user
export type NewUser = {
  name: string;
  email: string;
  role: 'Business' | 'Gorakshak';
  passwordplaintext: string;
};

// Define the structure of a Post, now with author details
export interface Post {
  id: number;
  content: string;
  latitude: number;
  longitude: number;
  createdat: string;
  mediaurl?: string | null;
  mediatype?: 'image' | 'video' | null;
  likecount: number;
  notifiedcount: number;
  viewcount: number;
  city?: string | null;
  hashtags?: string[] | null;
  authorid: number | null; // This will come from the posts table
  authorname: string | null; // This will be joined from the users table
  authorrole: UserRole | null; // This will be joined from the users table
  isLikedByCurrentUser?: boolean; // Added to track if the session user liked this post
}

// For creating a new post from the client, now authorId is optional
export type NewPost = {
  content: string;
  latitude: number;
  longitude: number;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  hashtags: string[];
  authorId?: number;
};

// For inserting a new post into the DB, authorid is now nullable
export type DbNewPost = Omit<NewPost, 'mediaUrl' | 'mediaType' | 'authorId'> & {
  mediaurl?: string | null;
  mediatype?: 'image' | 'video' | null;
  city?: string | null;
  hashtags: string[];
  authorid: number | null; 
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
