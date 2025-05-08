
import type { Database } from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Define the structure of a Post
export interface Post {
  id: number;
  content: string;
  latitude: number;
  longitude: number;
  createdAt: string; // Store as ISO string (TEXT in SQLite)
  mediaUrl?: string | null; // Optional URL for image/video (stored as TEXT/Data URL)
  mediaType?: 'image' | 'video' | null; // Type of media
  likeCount: number;
  city?: string | null; // City where the post was made
}

// Define the structure for adding a new post from the client (omit id, createdAt, likeCount, and city)
export type NewPost = Omit<Post, 'id' | 'createdAt' | 'likeCount' | 'city'>;

// Define the structure for inserting a new post into the DB (includes city)
export type DbNewPost = Omit<Post, 'id' | 'createdAt' | 'likeCount'>;


// Define the structure of a Comment
export interface Comment {
  id: number;
  postId: number;
  author: string;
  content: string;
  createdAt: string;
}

// Define the structure for adding a new comment
export type NewComment = Omit<Comment, 'id' | 'createdAt'>;

// Visitor stats structure
export interface VisitorCounts {
  totalVisits: number;
  dailyVisits: number;
}


// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'localpulse.db');
let db: Database;

try {
    const dbExists = fs.existsSync(dbPath);
    db = new DatabaseConstructor(dbPath, { verbose: console.log });
    console.log('Database connection established.');

    const postTableInfo = db.prepare("PRAGMA table_info(posts)").all();
    const postColumns = postTableInfo.map((col: any) => col.name);

    // Create/Update the posts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            createdAt TEXT NOT NULL,
            mediaUrl TEXT NULL,
            mediaType TEXT NULL,
            likeCount INTEGER NOT NULL DEFAULT 0,
            city TEXT NULL
        );
    `);
    console.log('Checked/Created posts table structure.');

    if (!postColumns.includes('mediaUrl')) {
        db.exec('ALTER TABLE posts ADD COLUMN mediaUrl TEXT NULL');
        console.log('Added mediaUrl column to posts table.');
    }
    if (!postColumns.includes('mediaType')) {
        db.exec('ALTER TABLE posts ADD COLUMN mediaType TEXT NULL');
        console.log('Added mediaType column to posts table.');
    }
    if (!postColumns.includes('likeCount')) {
        db.exec('ALTER TABLE posts ADD COLUMN likeCount INTEGER NOT NULL DEFAULT 0');
        console.log('Added likeCount column to posts table.');
    }
    if (!postColumns.includes('city')) {
        db.exec('ALTER TABLE posts ADD COLUMN city TEXT NULL');
        console.log('Added city column to posts table.');
    }

    // Create the comments table if it doesn't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postId INTEGER NOT NULL,
            author TEXT NOT NULL DEFAULT 'Anonymous',
            content TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
        );
    `);
    console.log('Checked/Created comments table.');

    // Initialize visitor statistics
    initializeVisitorStatsDb();


} catch (error) {
    console.error('Error initializing database:', error);
    throw new Error('Failed to initialize database');
}

// Function to get all posts, ordered by creation date descending
export function getPostsDb(): Post[] {
   try {
      const stmt = db.prepare('SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city FROM posts ORDER BY createdAt DESC');
      const posts = stmt.all() as Post[];
      console.log(`Fetched ${posts.length} posts.`);
      return posts;
   } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
   }
}

// Function to add a new post
export function addPostDb(newPost: DbNewPost): Post {
    try {
        const createdAt = new Date().toISOString();
        // likeCount defaults to 0 due to table definition
        const stmt = db.prepare('INSERT INTO posts (content, latitude, longitude, createdAt, mediaUrl, mediaType, city) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(
            newPost.content,
            newPost.latitude,
            newPost.longitude,
            createdAt,
            newPost.mediaUrl ?? null,
            newPost.mediaType ?? null,
            newPost.city ?? null
        );
        console.log(`Added post with ID: ${info.lastInsertRowid}`);
        const insertedPost = db.prepare('SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city FROM posts WHERE id = ?').get(info.lastInsertRowid) as Post;
        if (!insertedPost) throw new Error('Failed to retrieve the newly inserted post.');
        return insertedPost;
    } catch (error) {
        console.error('Error adding post:', error);
        throw new Error('Failed to add post to the database.');
    }
}

// Function to update like count for a post
export function updatePostLikeCountDb(postId: number, increment: boolean): Post | null {
    try {
        const currentPost = db.prepare('SELECT likeCount FROM posts WHERE id = ?').get(postId) as Pick<Post, 'likeCount'> | undefined;
        if (!currentPost) {
            console.error(`Post with id ${postId} not found for like update.`);
            return null;
        }

        let newLikeCount = currentPost.likeCount;
        if (increment) {
            newLikeCount += 1;
        } else {
            newLikeCount = Math.max(0, newLikeCount - 1); // Ensure like count doesn't go below 0
        }

        const stmt = db.prepare('UPDATE posts SET likeCount = ? WHERE id = ?');
        stmt.run(newLikeCount, postId);
        console.log(`Updated like count for post ${postId} to ${newLikeCount}`);

        return db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as Post | null;
    } catch (error) {
        console.error(`Error updating like count for post ${postId}:`, error);
        throw new Error('Failed to update like count.');
    }
}

// Function to add a comment
export function addCommentDb(commentData: NewComment): Comment {
    try {
        const createdAt = new Date().toISOString();
        const author = commentData.author || 'Anonymous';
        const stmt = db.prepare('INSERT INTO comments (postId, author, content, createdAt) VALUES (?, ?, ?, ?)');
        const info = stmt.run(commentData.postId, author, commentData.content, createdAt);
        console.log(`Added comment with ID: ${info.lastInsertRowid} to post ${commentData.postId}`);

        const insertedComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid) as Comment;
        if (!insertedComment) throw new Error('Failed to retrieve the newly inserted comment.');
        return insertedComment;
    } catch (error) {
        console.error(`Error adding comment to post ${commentData.postId}:`, error);
        throw new Error('Failed to add comment.');
    }
}

// Function to get comments for a post
export function getCommentsByPostIdDb(postId: number): Comment[] {
    try {
        const stmt = db.prepare('SELECT * FROM comments WHERE postId = ? ORDER BY createdAt ASC');
        const comments = stmt.all(postId) as Comment[];
        console.log(`Fetched ${comments.length} comments for post ${postId}.`);
        return comments;
    } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        return [];
    }
}

// Visitor Statistics Functions
function initializeVisitorStatsDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_stats (
      stat_name TEXT PRIMARY KEY,
      stat_value TEXT NULL
    );
  `);
  const todayStr = new Date().toISOString().split('T')[0];
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0')").run();
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', ?)").run(todayStr);
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0')").run();
  console.log('Checked/Initialized visitor_stats table.');
}

export function incrementAndGetVisitorCountsDb(): VisitorCounts {
  const todayStr = new Date().toISOString().split('T')[0];
  let dailyVisits: number;
  let totalVisits: number;

  db.transaction(() => {
    // Ensure rows exist (handles first ever run gracefully)
    db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0')").run();
    db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', ?)").run(todayStr);
    db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0')").run();

    // Handle daily visits
    const dailyDateRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'").get() as { stat_value: string } | undefined;
    const dailyCountRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_count'").get() as { stat_value: string } | undefined;

    if (dailyDateRow?.stat_value === todayStr) {
      const currentDailyCount = parseInt(dailyCountRow?.stat_value || '0', 10);
      dailyVisits = currentDailyCount + 1;
      db.prepare("UPDATE visitor_stats SET stat_value = ? WHERE stat_name = 'daily_visits_count'").run(dailyVisits.toString());
    } else {
      dailyVisits = 1;
      db.prepare("UPDATE visitor_stats SET stat_value = ? WHERE stat_name = 'daily_visits_date'").run(todayStr);
      db.prepare("UPDATE visitor_stats SET stat_value = ? WHERE stat_name = 'daily_visits_count'").run('1');
    }

    // Handle total visits
    const totalCountRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'total_visits'").get() as { stat_value: string } | undefined;
    const currentTotalCount = parseInt(totalCountRow?.stat_value || '0', 10);
    totalVisits = currentTotalCount + 1;
    db.prepare("UPDATE visitor_stats SET stat_value = ? WHERE stat_name = 'total_visits'").run(totalVisits.toString());
  })();

  // These will be assigned within the transaction
  // @ts-ignore
  return { totalVisits, dailyVisits };
}

export function getVisitorCountsDb(): VisitorCounts {
  const todayStr = new Date().toISOString().split('T')[0];

   // Ensure rows exist for reading
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0')").run();
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', ?)").run(todayStr);
  db.prepare("INSERT OR IGNORE INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0')").run();

  const totalRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'total_visits'").get() as { stat_value: string } | undefined;
  const totalVisits = parseInt(totalRow?.stat_value || '0', 10);

  const dailyDateRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'").get() as { stat_value: string } | undefined;
  const dailyCountRow = db.prepare("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_count'").get() as { stat_value: string } | undefined;

  let dailyVisits = 0;
  if (dailyDateRow?.stat_value === todayStr) {
    dailyVisits = parseInt(dailyCountRow?.stat_value || '0', 10);
  } else {
    // If date is not today, it means today's count is effectively 0 until the first visit increments it.
    // We might want to reset daily_visits_count to 0 and update daily_visits_date to todayStr here if just fetching.
    // For simplicity now, if date is old, daily is 0. incrementAndGet will fix it on next actual visit.
  }

  return { totalVisits, dailyVisits };
}


export function closeDb() {
  if (db) {
    db.close();
    console.log('Database connection closed.');
  }
}

process.on('exit', () => closeDb());
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
