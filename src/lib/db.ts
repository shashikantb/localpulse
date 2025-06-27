
import { Pool, type QueryResult } from 'pg';
import type { Post, DbNewPost, Comment, NewComment, VisitorCounts, DeviceToken, User, UserWithPassword, NewUser, UserRole } from './db-types';
import bcrypt from 'bcryptjs';

// Define the structure of a Post, Comment, VisitorCounts, etc. in db-types.ts if not already
export * from './db-types';

// Declare variables that will hold the function implementations
let getPostsDb: (options?: { limit: number; offset: number }, userRole?: UserRole) => Promise<Post[]>;
let getMediaPostsDb: (options?: { limit: number; offset: number; }) => Promise<Post[]>;
let addPostDb: (newPost: DbNewPost) => Promise<Post>;
let incrementPostLikeCountDb: (postId: number) => Promise<Post | null>;
let addCommentDb: (commentData: NewComment) => Promise<Comment>;
let getCommentsByPostIdDb: (postId: number) => Promise<Comment[]>;
let incrementAndGetVisitorCountsDb: () => Promise<VisitorCounts>;
let getVisitorCountsDb: () => Promise<VisitorCounts>;
let addOrUpdateDeviceTokenDb: (token: string, latitude?: number, longitude?: number) => Promise<void>;
let getNearbyDeviceTokensDb: (latitude: number, longitude: number, radiusKm?: number) => Promise<string[]>;
let deleteDeviceTokenDb: (token: string) => Promise<void>;
let getNewerPostsCountDb: (latestIdKnown: number) => Promise<number>;
let closeDb: () => Promise<void>;
let incrementPostViewCountDb: (postId: number) => Promise<void>;
let updateNotifiedCountDb: (postId: number, count: number) => Promise<void>;

// New user functions
let createUserDb: (newUser: NewUser, status?: 'pending' | 'approved') => Promise<User>;
let getUserByEmailDb: (email: string) => Promise<UserWithPassword | null>;
let getUserByIdDb: (id: number) => Promise<User | null>;
let getPostsByUserIdDb: (userId: number) => Promise<Post[]>;
let getPendingUsersDb: () => Promise<User[]>