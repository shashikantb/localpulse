
import { Pool, type QueryResult } from 'pg';
import type { Post, DbNewPost, Comment, NewComment, VisitorCounts, DeviceToken } from './db-types';

// Define the structure of a Post, Comment, VisitorCounts, etc. in db-types.ts if not already
export * from './db-types';

// Declare variables that will hold the function implementations
let getPostsDb: () => Promise<Post[]>;
let addPostDb: (newPost: DbNewPost) => Promise<Post>;
let incrementPostLikeCountDb: (postId: number) => Promise<Post | null>;
let addCommentDb: (commentData: NewComment) => Promise<Comment>;
let getCommentsByPostIdDb: (postId: number) => Promise<Comment[]>;
let incrementAndGetVisitorCountsDb: () => Promise<VisitorCounts>;
let getVisitorCountsDb: () => Promise<VisitorCounts>;
let addOrUpdateDeviceTokenDb: (token: string, latitude?: number, longitude?: number) => Promise<void>;
let getNearbyDeviceTokensDb: (latitude: number, longitude: number, radiusKm?: number) => Promise<string[]>;
let getNewerPostsCountDb: (latestIdKnown: number) => Promise<number>;
let closeDb: () => Promise<void>;


// Check for the environment variable. If not found, use mock implementations.
if (!process.env.POSTGRES_URL) {
  console.warn(
    '\x1b[33m%s\x1b[0m', // Yellow text
    `
    ##########################################################################################
    # WARNING: The POSTGRES_URL environment variable is not defined.                         #
    # The application is running in a mock data mode.                                        #
    # UI will be interactive, but data will not be saved to or loaded from a database.       #
    # To connect to a database, create a .env.local file and set POSTGRES_URL.               #
    # See README.md for more details.                                                        #
    ##########################################################################################
    `
  );

  const dbNotConfiguredError = () => Promise.reject(new Error("Database is not configured. Please set the POSTGRES_URL environment variable."));

  // --- MOCK IMPLEMENTATIONS ---
  getPostsDb = async (): Promise<Post[]> => { console.warn("MOCK DB: getPostsDb called"); return []; };
  addPostDb = async (newPost: DbNewPost): Promise<Post> => { await dbNotConfiguredError(); return null as any; };
  incrementPostLikeCountDb = async (postId: number): Promise<Post | null> => { await dbNotConfiguredError(); return null; };
  addCommentDb = async (commentData: NewComment): Promise<Comment> => { await dbNotConfiguredError(); return null as any; };
  getCommentsByPostIdDb = async (postId: number): Promise<Comment[]> => { console.warn("MOCK DB: getCommentsByPostIdDb called"); return []; };
  incrementAndGetVisitorCountsDb = async (): Promise<VisitorCounts> => { console.warn("MOCK DB: incrementAndGetVisitorCountsDb called"); return { totalVisits: 0, dailyVisits: 0 }; };
  getVisitorCountsDb = async (): Promise<VisitorCounts> => { console.warn("MOCK DB: getVisitorCountsDb called"); return { totalVisits: 0, dailyVisits: 0 }; };
  addOrUpdateDeviceTokenDb = async (token: string, latitude?: number, longitude?: number): Promise<void> => { console.warn("MOCK DB: addOrUpdateDeviceTokenDb called"); return; };
  getNearbyDeviceTokensDb = async (latitude: number, longitude: number, radiusKm: number = 10): Promise<string[]> => { console.warn("MOCK DB: getNearbyDeviceTokensDb called"); return []; };
  getNewerPostsCountDb = async (latestIdKnown: number): Promise<number> => { console.warn("MOCK DB: getNewerPostsCountDb called"); return 0; };
  closeDb = async (): Promise<void> => { console.warn("MOCK DB: closeDb called"); return; };

} else {
  // --- REAL DATABASE IMPLEMENTATIONS ---

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL, // Example: postgres://user:password@host:port/database
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  pool.on('connect', () => {
    console.log('PostgreSQL connected');
  });
  
  pool.on('error', (err) => {
    console.error('PostgreSQL client error:', err);
  });
  
  async function checkTableExists(client: any, tableName: string): Promise<boolean> {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = $1
      );
    `, [tableName]);
    return res.rows[0].exists;
  }
  
  async function initializeDatabaseSchema(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      const postsTableExists = await checkTableExists(client, 'posts');
      if (!postsTableExists) {
        console.log('Posts table does not exist. Creating...');
      }
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          mediaUrl TEXT NULL,
          mediaType TEXT NULL,
          likeCount INTEGER NOT NULL DEFAULT 0 CHECK (likeCount >= 0),
          city TEXT NULL,
          hashtags TEXT[] NULL
        );
      `);
      console.log('Checked/Created posts table structure.');
       // Ensure hashtags column exists if table already existed
      if (postsTableExists) {
          const hasHashtagsColumn = await client.query(`
              SELECT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name='posts' AND column_name='hashtags'
              );
          `);
          if (!hasHashtagsColumn.rows[0].exists) {
              await client.query('ALTER TABLE posts ADD COLUMN hashtags TEXT[] NULL;');
              console.log('Added hashtags column to existing posts table.');
          }
      }
  
  
      const commentsTableExists = await checkTableExists(client, 'comments');
       if (!commentsTableExists) {
        console.log('Comments table does not exist. Creating...');
      }
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
  
      const visitorStatsTableExists = await checkTableExists(client, 'visitor_stats');
      if (!visitorStatsTableExists) {
        console.log('Visitor_stats table does not exist. Creating...');
      }
      await client.query(`
        CREATE TABLE IF NOT EXISTS visitor_stats (
          stat_name VARCHAR(255) PRIMARY KEY,
          stat_value TEXT NULL
        );
      `);
       console.log('Checked/Created visitor_stats table.');
  
      const deviceTokensTableExists = await checkTableExists(client, 'device_tokens');
      if (!deviceTokensTableExists) {
          console.log('Device_tokens table does not exist. Creating...');
      }
      await client.query(`
        CREATE TABLE IF NOT EXISTS device_tokens (
          id SERIAL PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          latitude REAL NULL,
          longitude REAL NULL,
          last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Checked/Created device_tokens table.');
  
  
      const todayStr = new Date().toISOString().split('T')[0];
      await client.query(
        "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0') ON CONFLICT (stat_name) DO NOTHING"
      );
      await client.query(
        "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', $1) ON CONFLICT (stat_name) DO UPDATE SET stat_value = EXCLUDED.stat_value WHERE visitor_stats.stat_name = 'daily_visits_date' AND (visitor_stats.stat_value IS NULL OR visitor_stats.stat_value != EXCLUDED.stat_value)",
        [todayStr]
      );
       await client.query(
        "INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0') ON CONFLICT (stat_name) DO NOTHING"
      );
      console.log('Initialized/Verified visitor_stats data.');
      
      await client.query('COMMIT');
      console.log('Database schema initialization complete.');
    } catch (error: any) {
      await client.query('ROLLBACK');
      let specificMessage = 'Failed to initialize database schema';
      let loggedError = error;
  
      if (error && typeof error.code === 'string' && error.code === '42501') { // PostgreSQL "insufficient_privilege"
        specificMessage = `Failed to initialize database schema due to insufficient PostgreSQL permissions. User (e.g., from your POSTGRES_URL) likely lacks CREATE TABLE, USAGE ON SCHEMA public, or other necessary DDL/DML privileges on the target database. Please grant required permissions. Original PostgreSQL error: ${error.message} (Code: ${error.code})`;
        console.error("Database Permission Error During Schema Initialization:", specificMessage);
        loggedError = new Error(specificMessage, { cause: error });
      } else {
        const originalErrorMessage = error instanceof Error ? error.message : String(error);
        specificMessage = `Failed to initialize database schema. Original error: ${originalErrorMessage}`;
        console.error('Generic Error Initializing Database Schema:', error, '\nFull error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        loggedError = new Error(specificMessage, { cause: error });
      }
      throw loggedError;
    } finally {
      client.release();
    }
  }
  
  initializeDatabaseSchema().catch(err => {
      console.error("Critical: Failed to initialize DB schema on startup. Application might not function correctly.", err);
  });
  
  
  getPostsDb = async (): Promise<Post[]> => {
    try {
      const result: QueryResult<Post> = await pool.query(
        'SELECT id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city, hashtags FROM posts ORDER BY createdAt DESC'
      );
      return result.rows;
    } catch (error) {
      console.error("Error fetching posts from DB:", error);
      const postsTableExists = await checkTableExists(await pool.connect(), 'posts');
      if (!postsTableExists) {
          console.error("The 'posts' table does not exist. Please ensure the database schema is initialized correctly.");
          throw new Error("Database schema error: 'posts' table not found. Try restarting the application to initialize the schema.");
      }
      throw error; // Re-throw original error if table exists but query failed for other reasons
    }
  }
  
  addPostDb = async (newPost: DbNewPost): Promise<Post> => {
    try {
      const createdAt = new Date();
      const result: QueryResult<Post> = await pool.query(
        'INSERT INTO posts (content, latitude, longitude, createdAt, mediaUrl, mediaType, city, hashtags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city, hashtags',
        [
          newPost.content,
          newPost.latitude,
          newPost.longitude,
          createdAt,
          newPost.mediaurl ?? null, 
          newPost.mediatype ?? null, 
          newPost.city ?? null,
          newPost.hashtags && newPost.hashtags.length > 0 ? newPost.hashtags : null,
        ]
      );
      const insertedPost = result.rows[0];
      if (!insertedPost) throw new Error('Failed to retrieve the newly inserted post. INSERT may have failed silently.');
      console.log(`Added post with ID: ${insertedPost.id}`);
      return insertedPost;
    } catch (error: any) {
      console.error('Error adding post to database:', error);
      const postsTableExists = await checkTableExists(await pool.connect(), 'posts');
      if (!postsTableExists) {
          console.error("The 'posts' table does not exist. Please ensure the database schema is initialized correctly before adding posts.");
          throw new Error("Database schema error: 'posts' table not found. Cannot add post. Try restarting the application.");
      }
      const message = error.message || 'Failed to add post to the database due to an unknown issue.';
      const detailedMessage = error.detail ? `${message} Detail: ${error.detail}` : message;
      throw new Error(`Database operation failed for addPostDb: ${detailedMessage}`);
    }
  }
  
  incrementPostLikeCountDb = async (postId: number): Promise<Post | null> => {
    try {
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
          return null;
      }
    } catch (error: any) {
      console.error(`Error incrementing like count for post ${postId} in DB:`, error);
      const detailedMessage = error.message || 'Failed to increment like count in DB.';
      throw new Error(detailedMessage);
    }
  }
  
  
  addCommentDb = async (commentData: NewComment): Promise<Comment> => {
    try {
      const createdAt = new Date();
      const author = commentData.author || 'Anonymous';
      const result: QueryResult<Comment> = await pool.query(
        'INSERT INTO comments (postId, author, content, createdAt) VALUES ($1, $2, $3, $4) RETURNING *',
        [commentData.postId, author, commentData.content, createdAt]
      );
      const insertedComment = result.rows[0];
      if (!insertedComment) throw new Error('Failed to retrieve the newly inserted comment.');
      return insertedComment;
    } catch (error: any) {
      console.error(`Error adding comment to post ${commentData.postId} in DB:`, error);
      const commentsTableExists = await checkTableExists(await pool.connect(), 'comments');
      if (!commentsTableExists) {
          console.error("The 'comments' table does not exist. Please ensure the database schema is initialized correctly.");
          throw new Error("Database schema error: 'comments' table not found. Cannot add comment.");
      }
      const message = error.message || 'Failed to add comment to the database.';
      const detailedMessage = error.detail ? `${message} Detail: ${error.detail}` : message;
      throw new Error(`Database operation failed for addCommentDb: ${detailedMessage}`);
    }
  }
  
  getCommentsByPostIdDb = async (postId: number): Promise<Comment[]> => {
    try {
      const result: QueryResult<Comment> = await pool.query(
        'SELECT * FROM comments WHERE postId = $1 ORDER BY createdAt ASC',
        [postId]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error fetching comments for post ${postId} from DB:`, error);
      const commentsTableExists = await checkTableExists(await pool.connect(), 'comments');
       if (!commentsTableExists) {
          console.error("The 'comments' table does not exist. Please ensure the database schema is initialized correctly.");
      }
      return [];
    }
  }
  
  incrementAndGetVisitorCountsDb = async (): Promise<VisitorCounts> => {
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
      const visitorTableExists = await checkTableExists(client, 'visitor_stats');
      if (!visitorTableExists) {
          console.error("The 'visitor_stats' table does not exist.");
          throw new Error("Database schema error: 'visitor_stats' table not found.");
      }
      throw error;
    } finally {
      client.release();
    }
  }
  
  getVisitorCountsDb = async (): Promise<VisitorCounts> => {
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
      }
      return { totalVisits, dailyVisits };
    } catch (error) {
      console.error('Error getting visitor counts from DB:', error);
      const visitorTableExists = await checkTableExists(await pool.connect(), 'visitor_stats');
      if (!visitorTableExists) {
          console.error("The 'visitor_stats' table does not exist.");
      }
      return { totalVisits: 0, dailyVisits: 0 };
    }
  }
  
  // Device Token Management
  addOrUpdateDeviceTokenDb = async (
    token: string,
    latitude?: number,
    longitude?: number
  ): Promise<void> => {
    try {
      await pool.query(
        `INSERT INTO device_tokens (token, latitude, longitude, last_updated)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (token) DO UPDATE SET
           latitude = COALESCE($2, device_tokens.latitude),
           longitude = COALESCE($3, device_tokens.longitude),
           last_updated = NOW()`,
        [token, latitude, longitude]
      );
      console.log(`Device token ${latitude ? 'updated with location' : 'registered/updated'}: ${token.substring(0,20)}...`);
    } catch (error) {
      console.error('Error adding/updating device token in DB:', error);
      throw new Error('Failed to save device token.');
    }
  }
  
  getNearbyDeviceTokensDb = async (
    latitude: number,
    longitude: number,
    radiusKm: number = 10 // Default radius 10km
  ): Promise<string[]> => {
    try {
      // Approximate bounding box calculation
      const latDelta = radiusKm / 111.0; // Degrees per km for latitude
      const lonDelta = radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180)); // Degrees per km for longitude
  
      const minLat = latitude - latDelta;
      const maxLat = latitude + latDelta;
      const minLon = longitude - lonDelta;
      const maxLon = longitude + lonDelta;
  
      const result: QueryResult<{ token: string }> = await pool.query(
        `SELECT token FROM device_tokens
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
           AND latitude BETWEEN $1 AND $2
           AND longitude BETWEEN $3 AND $4`,
        [minLat, maxLat, minLon, maxLon]
      );
      
      console.log(`Found ${result.rows.length} tokens in bounding box for location ${latitude},${longitude} with radius ${radiusKm}km.`);
      return result.rows.map(row => row.token);
    } catch (error) {
      console.error('Error fetching nearby device tokens from DB:', error);
      return [];
    }
  }
  
  getNewerPostsCountDb = async (latestIdKnown: number): Promise<number> => {
    try {
      const result: QueryResult<{ count: string }> = await pool.query(
        'SELECT COUNT(*) FROM posts WHERE id > $1',
        [latestIdKnown]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error('Error counting newer posts from DB:', error);
      return 0;
    }
  }
  
  
  closeDb = async (): Promise<void> => {
    try {
      await pool.end();
      console.log('PostgreSQL pool has ended');
    } catch (error) {
      console.error('Error closing PostgreSQL pool:', error);
    }
  }
  
  const cleanup = async () => {
    console.log('Closing database pool...');
    await closeDb();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    console.log('Application exiting. Ensuring DB pool is closed if not already.');
  });
}

// Export the functions
export {
  getPostsDb,
  addPostDb,
  incrementPostLikeCountDb,
  addCommentDb,
  getCommentsByPostIdDb,
  incrementAndGetVisitorCountsDb,
  getVisitorCountsDb,
  addOrUpdateDeviceTokenDb,
  getNearbyDeviceTokensDb,
  getNewerPostsCountDb,
  closeDb
};
