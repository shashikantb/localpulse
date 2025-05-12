import { Pool, type QueryResult } from 'pg';
import type { Post, NewPost, DbNewPost, Comment, NewComment, VisitorCounts } from './db-types';

// Define the structure of a Post, Comment, VisitorCounts, etc. in db-types.ts if not already
export * from './db-types';


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL, // Example: postgres://user:password@host:port/database
  // Or use individual environment variables:
  // user: process.env.POSTGRES_USER,
  // host: process.env.POSTGRES_HOST,
  // database: process.env.POSTGRES_DATABASE,
  // password: process.env.POSTGRES_PASSWORD,
  // port: parseInt(process.env.POSTGRES_PORT || "5432"),
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL client error:', err);
});

async function initializeDatabaseSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create/Update the posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        mediaUrl TEXT NULL,
        mediaType TEXT NULL,
        likeCount INTEGER NOT NULL DEFAULT 0 CHECK (likeCount >= 0), -- Ensure likeCount doesn't go below 0
        city TEXT NULL
      );
    `);
    console.log('Checked/Created posts table structure.');

    // Create the comments table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        postId INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author TEXT NOT NULL DEFAULT 'Anonymous',
        content TEXT NOT NULL,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/Created comments table.');

    // Create visitor_stats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_stats (
        stat_name VARCHAR(255) PRIMARY KEY,
        stat_value TEXT NULL
      );
    `);
     console.log('Checked/Created visitor_stats table.');

    // Initialize visitor statistics
    const todayStr = new Date().toISOString().split('T')[0];
    await client.query(
      "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0') ON CONFLICT (stat_name) DO NOTHING"
    );
    // Use DO UPDATE for daily_visits_date to ensure it gets set if it was NULL or missing
    await client.query(
        "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', $1) ON CONFLICT (stat_name) DO UPDATE SET stat_value = EXCLUDED.stat_value",
        [todayStr]
    );
     await client.query(
      "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0') ON CONFLICT (stat_name) DO NOTHING"
    );
    console.log('Initialized/Verified visitor_stats data.');

    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    let specificMessage = 'Failed to initialize database schema';
    let loggedError = error;

    if (error && typeof error.code === 'string' && error.code === '42501') { // PostgreSQL "insufficient_privilege"
      specificMessage = `Failed to initialize database schema due to insufficient PostgreSQL permissions. User (e.g., from your POSTGRES_URL) likely lacks CREATE TABLE, USAGE ON SCHEMA public, or other necessary DDL/DML privileges on the target database. Please grant required permissions. Original PostgreSQL error: ${error.message} (Code: ${error.code})`;
      console.error("Database Permission Error During Schema Initialization:", specificMessage);
      console.error("Full PostgreSQL error object for diagnostics:", error);
      loggedError = new Error(specificMessage, { cause: error });
    } else {
      const originalErrorMessage = error instanceof Error ? error.message : String(error);
      specificMessage = `Failed to initialize database schema. Original error: ${originalErrorMessage}`;
      console.error('Generic Error Initializing Database Schema:', error);
      loggedError = new Error(specificMessage, { cause: error });
    }
    throw loggedError; // Re-throw the enriched or original error
  } finally {
    client.release();
  }
}

// Initialize schema on startup
initializeDatabaseSchema().catch(err => {
    console.error("Critical: Failed to initialize DB schema on startup. Application might not function correctly.", err);
    // Depending on the application's needs, you might want to exit here
    // process.exit(1);
});


// Function to get all posts, ordered by creation date descending
export async function getPostsDb(): Promise<Post[]> {
  try {
    const result: QueryResult<Post> = await pool.query(
      'SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city FROM posts ORDER BY createdAt DESC'
    );
    // console.log(`Fetched ${result.rowCount} posts.`); // Less verbose logging
    return result.rows;
  } catch (error) {
    console.error('Error fetching posts from DB:', error);
    // In a real app, you might want to throw an error or return a specific error indicator
    return [];
  }
}

// Function to add a new post
export async function addPostDb(newPost: DbNewPost): Promise<Post> {
  try {
    const createdAt = new Date();
    const result: QueryResult<Post> = await pool.query(
      'INSERT INTO posts (content, latitude, longitude, createdAt, mediaUrl, mediaType, city) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city',
      [
        newPost.content,
        newPost.latitude,
        newPost.longitude,
        createdAt,
        newPost.mediaUrl ?? null,
        newPost.mediaType ?? null,
        newPost.city ?? null
      ]
    );
    const insertedPost = result.rows[0];
    if (!insertedPost) throw new Error('Failed to retrieve the newly inserted post. INSERT may have failed silently.');
    console.log(`Added post with ID: ${insertedPost.id}`);
    return insertedPost;
  } catch (error: any) {
    console.error('Error adding post to database:', error);
    const message = error.message || 'Failed to add post to the database due to an unknown issue.';
    const detailedMessage = error.detail ? `${message} Detail: ${error.detail}` : message;
    throw new Error(`Database operation failed for addPostDb: ${detailedMessage}`);
  }
}

// Function to increment the like count for a post
export async function incrementPostLikeCountDb(postId: number): Promise<Post | null> {
  try {
    // Atomically increment the like count
    const updateResult: QueryResult<Post> = await pool.query(
      'UPDATE posts SET likeCount = likeCount + 1 WHERE id = $1 RETURNING *',
      [postId]
    );

    const updatedPost = updateResult.rows[0];
    if (updatedPost) {
        console.log(`Incremented like count for post ${postId} to ${updatedPost.likecount}`);
        return updatedPost;
    } else {
        console.warn(`Post with id ${postId} not found for like increment.`);
        return null; // Post not found
    }
  } catch (error) {
    console.error(`Error incrementing like count for post ${postId} in DB:`, error);
    throw new Error('Failed to increment like count in DB.');
  }
}


// Function to add a comment
export async function addCommentDb(commentData: NewComment): Promise<Comment> {
  try {
    const createdAt = new Date();
    const author = commentData.author || 'Anonymous';
    const result: QueryResult<Comment> = await pool.query(
      'INSERT INTO comments (postId, author, content, createdAt) VALUES ($1, $2, $3, $4) RETURNING *',
      [commentData.postId, author, commentData.content, createdAt]
    );
    const insertedComment = result.rows[0];
    if (!insertedComment) throw new Error('Failed to retrieve the newly inserted comment.');
    // console.log(`Added comment with ID: ${insertedComment.id} to post ${commentData.postId}`);
    return insertedComment;
  } catch (error: any) {
    console.error(`Error adding comment to post ${commentData.postId} in DB:`, error);
    const message = error.message || 'Failed to add comment to the database.';
    const detailedMessage = error.detail ? `${message} Detail: ${error.detail}` : message;
    throw new Error(`Database operation failed for addCommentDb: ${detailedMessage}`);
  }
}

// Function to get comments for a post
export async function getCommentsByPostIdDb(postId: number): Promise<Comment[]> {
  try {
    const result: QueryResult<Comment> = await pool.query(
      'SELECT * FROM comments WHERE postId = $1 ORDER BY createdAt ASC',
      [postId]
    );
    // console.log(`Fetched ${result.rowCount} comments for post ${postId}.`);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId} from DB:`, error);
    return [];
  }
}


// Visitor Statistics Functions
export async function incrementAndGetVisitorCountsDb(): Promise<VisitorCounts> {
  const todayStr = new Date().toISOString().split('T')[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totalUpdateResult = await client.query<{ stat_value: string }>(
      "UPDATE visitor_stats SET stat_value = (COALESCE(stat_value, '0')::INTEGER + 1)::TEXT WHERE stat_name = 'total_visits' RETURNING stat_value"
    );
    const totalVisits = parseInt(totalUpdateResult.rows[0]?.stat_value || '0', 10);

    const dailyDateRow = await client.query<{ stat_value: string }>(
      "SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'"
    );

    let dailyVisits: number;
    if (dailyDateRow.rows[0]?.stat_value === todayStr) {
      const dailyUpdateResult = await client.query<{ stat_value: string }>(
        "UPDATE visitor_stats SET stat_value = (COALESCE(stat_value, '0')::INTEGER + 1)::TEXT WHERE stat_name = 'daily_visits_count' RETURNING stat_value"
      );
      dailyVisits = parseInt(dailyUpdateResult.rows[0]?.stat_value || '0', 10);
    } else {
      await client.query(
        "UPDATE visitor_stats SET stat_value = $1 WHERE stat_name = 'daily_visits_date'",
        [todayStr]
      );
      await client.query(
        "UPDATE visitor_stats SET stat_value = '1' WHERE stat_name = 'daily_visits_count'"
      );
      dailyVisits = 1;
    }

    await client.query('COMMIT');
    return { totalVisits, dailyVisits };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error incrementing visitor counts in DB:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getVisitorCountsDb(): Promise<VisitorCounts> {
 try {
    const todayStr = new Date().toISOString().split('T')[0];

    const totalRowResult = await pool.query<{ stat_value: string }>(
      "SELECT stat_value FROM visitor_stats WHERE stat_name = 'total_visits'"
    );
    const totalVisits = parseInt(totalRowResult.rows[0]?.stat_value || '0', 10);

    const dailyDateRowResult = await pool.query<{ stat_value: string }>(
      "SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'"
    );

    let dailyVisits = 0;
    if (dailyDateRowResult.rows[0]?.stat_value === todayStr) {
      const dailyCountRowResult = await pool.query<{ stat_value: string }>(
        "SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_count'"
      );
      dailyVisits = parseInt(dailyCountRowResult.rows[0]?.stat_value || '0', 10);
    } else {
      // If the date doesn't match today, daily visits should be 0 for "today"
      // but we might also want to reset the daily_visits_count for the new day.
      // The incrementAndGetVisitorCountsDb handles this reset logic.
      // For just getting, if date is not today, today's count is 0.
    }
    return { totalVisits, dailyVisits };
  } catch (error) {
    console.error('Error getting visitor counts from DB:', error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}


export async function closeDb(): Promise<void> {
  try {
    await pool.end();
    console.log('PostgreSQL pool has ended');
  } catch (error) {
    console.error('Error closing PostgreSQL pool:', error);
  }
}

// Graceful shutdown
const cleanup = async () => {
  console.log('Closing database pool...');
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  console.log('Application exiting. Ensuring DB pool is closed if not already.');
  // closeDb(); // Call closeDb directly here might be problematic if already called by SIGINT/SIGTERM
});