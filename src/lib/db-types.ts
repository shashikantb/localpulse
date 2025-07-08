

export type UserRole = 'Business' | 'Gorakshak' | 'Admin' | 'Public(जनता)';

export type SortOption = 'newest' | 'likes' | 'comments';

// Define the structure of a User for client-side use (omitting password)
export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  createdat: string;
  profilepictureurl?: string | null;
  mobilenumber?: string | null;
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
  mobilenumber?: string;
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
  viewcount: number;
  notifiedcount: number;
  city?: string | null;
  hashtags?: string[] | null;
  is_family_post: boolean;
  hide_location: boolean;
  authorid: number | null; // This will come from the posts table
  authorname: string | null; // This will be joined from the users table
  authorrole: UserRole | null; // This will be joined from the users table
  authorprofilepictureurl?: string | null; // This will be joined from the users table
  isLikedByCurrentUser?: boolean; // Added to track if the session user liked this post
  isAuthorFollowedByCurrentUser?: boolean;
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
  isFamilyPost: boolean;
  hideLocation: boolean;
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
  is_family_post: boolean;
  hide_location: boolean;
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

// --- Status (Story) Types ---

export interface Status {
  id: number;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
}

export interface UserWithStatuses {
  userId: number;
  userName: string;
  userProfilePictureUrl?: string | null;
  statuses: Status[];
}

export type NewStatus = {
  userId: number;
  mediaUrl: string;
  mediaType: 'image' | 'video';
};

// --- Chat Types ---

export interface Conversation {
  id: number;
  created_at: string;
  last_message_at: string;
  // Details of the other participant
  participant_id: number;
  participant_name: string;
  participant_profile_picture_url?: string | null;
  last_message_content?: string | null;
  last_message_sender_id?: number | null;
  unread_count: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

export interface NewMessage {
    conversationId: number;
    senderId: number;
    content: string;
}

export interface ConversationParticipant {
    id: number;
    name: string;
    profilepictureurl?: string | null;
}

// --- Family Relationship Types ---
export type FamilyRelationshipStatus = 'none' | 'pending_from_me' | 'pending_from_them' | 'approved';

export interface FamilyRelationship {
    id: number;
    user_id_1: number;
    user_id_2: number;
    requester_id: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    share_location_from_1_to_2: boolean;
    share_location_from_2_to_1: boolean;
}

export interface PendingFamilyRequest {
    id: number; // The relationship ID
    requester_id: number;
    requester_name: string;
    requester_profile_picture_url?: string | null;
}

export interface FamilyMember extends User {
    i_am_sharing_with_them: boolean;
    they_are_sharing_with_me: boolean;
    latitude?: number | null;
    longitude?: number | null;
    last_updated?: string | null;
}

export interface FamilyMemberLocation {
    id: number;
    name: string;
    profilepictureurl?: string | null;
    latitude: number;
    longitude: number;
    last_updated: string;
}
