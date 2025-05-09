
// Define the structure of a Post
export interface Post {
  id: number;
  content: string;
  latitude: number;
  longitude: number;
  createdat: string; // PostgreSQL returns lowercase for TIMESTAMPTZ column names
  mediaurl?: string | null; 
  mediatype?: 'image' | 'video' | null;
  likecount: number;
  city?: string | null; 
}

// Define the structure for adding a new post from the client (omit id, createdAt, likeCount, and city)
// Note: Frontend might send mixed case, but DB interactions will use lowercase from 'pg'
export type NewPost = {
  content: string;
  latitude: number;
  longitude: number;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
};

// Define the structure for inserting a new post into the DB (includes city)
export type DbNewPost = NewPost & {
  city?: string | null;
};


// Define the structure of a Comment
export interface Comment {
  id: number;
  postid: number;
  author: string;
  content: string;
  createdat: string; // PostgreSQL returns lowercase
}

// Define the structure for adding a new comment
export type NewComment = {
  postId: number; // Keep camelCase for frontend consistency
  author: string;
  content: string;
};

// Visitor stats structure
export interface VisitorCounts {
  totalVisits: number;
  dailyVisits: number;
}
