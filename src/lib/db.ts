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
}

// Define the structure for adding a new post (omit id and createdAt)
export type NewPost = Omit<Post, 'id' | 'createdAt'>;


// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'localpulse.db');
let db: Database;

try {
    // Check if the database file exists, if not, it will be created
    const dbExists = fs.existsSync(dbPath);
    console.log(`Database path: ${dbPath}`);
    console.log(`Database exists: ${dbExists}`);

    db = new DatabaseConstructor(dbPath, { verbose: console.log }); // Enable verbose logging for debugging
    console.log('Database connection established.');

    // Get existing columns
    const tableInfo = db.prepare("PRAGMA table_info(posts)").all();
    const columns = tableInfo.map((col: any) => col.name);

    // Create the posts table if it doesn't exist (idempotent)
     db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            createdAt TEXT NOT NULL
        );
    `);
     console.log('Checked/Created posts table.');

     // Add mediaUrl column if it doesn't exist
    if (!columns.includes('mediaUrl')) {
        db.exec('ALTER TABLE posts ADD COLUMN mediaUrl TEXT NULL');
        console.log('Added mediaUrl column to posts table.');
    }
    // Add mediaType column if it doesn't exist
    if (!columns.includes('mediaType')) {
        db.exec('ALTER TABLE posts ADD COLUMN mediaType TEXT NULL');
        console.log('Added mediaType column to posts table.');
    }


} catch (error) {
    console.error('Error initializing database:', error);
    // Rethrow or handle appropriately in a real application
    throw new Error('Failed to initialize database');
}


// Function to get all posts, ordered by creation date descending
export function getPosts(): Post[] {
   try {
      const stmt = db.prepare('SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType FROM posts ORDER BY createdAt DESC');
      const posts = stmt.all() as Post[];
       console.log(`Fetched ${posts.length} posts.`);
      return posts;
   } catch (error) {
      console.error('Error fetching posts:', error);
      return []; // Return empty array on error
   }
}

// Function to add a new post
export function addPost(newPost: NewPost): Post {
    try {
        const createdAt = new Date().toISOString(); // Get current time in ISO format
        const stmt = db.prepare('INSERT INTO posts (content, latitude, longitude, createdAt, mediaUrl, mediaType) VALUES (?, ?, ?, ?, ?, ?)');
        const info = stmt.run(
            newPost.content,
            newPost.latitude,
            newPost.longitude,
            createdAt,
            newPost.mediaUrl ?? null, // Use null if undefined
            newPost.mediaType ?? null // Use null if undefined
        );
         console.log(`Added post with ID: ${info.lastInsertRowid}`);

        // Retrieve the newly inserted post to return it including the ID and timestamp
        const insertedPost = db.prepare('SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType FROM posts WHERE id = ?').get(info.lastInsertRowid) as Post;

        if (!insertedPost) {
            throw new Error('Failed to retrieve the newly inserted post.');
        }
        return insertedPost;
    } catch (error) {
        console.error('Error adding post:', error);
        throw new Error('Failed to add post to the database.'); // Rethrow or handle error appropriately
    }
}

// Optional: Function to close the database connection gracefully (e.g., during app shutdown)
export function closeDb() {
  if (db) {
    db.close();
     console.log('Database connection closed.');
  }
}

// Ensure graceful shutdown
process.on('exit', () => closeDb());
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
