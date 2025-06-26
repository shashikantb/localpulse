
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

// New user functions
let createUserDb: (newUser: NewUser) => Promise<User>;
let getUserByEmailDb: (email: string) => Promise<UserWithPassword | null>;
let getUserByIdDb: (id: number) => Promise<User | null>;
let getPostsByUserIdDb: (userId: number) => Promise<Post[]>;
let getPendingUsersDb: () => Promise<User[]>;
let updateUserStatusDb: (userId: number, status: 'approved' | 'rejected') => Promise<User | null>;
let getAllUsersDb: () => Promise<User[]>;


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
  getPostsDb = async (options?: { limit: number; offset: number; }, userRole?: UserRole): Promise<Post[]> => { console.warn("MOCK DB: getPostsDb called"); return []; };
  getMediaPostsDb = async (options?: { limit: number; offset: number; }): Promise<Post[]> => { console.warn("MOCK DB: getMediaPostsDb called"); return []; };
  addPostDb = async (newPost: DbNewPost): Promise<Post> => { await dbNotConfiguredError(); return null as any; };
  incrementPostLikeCountDb = async (postId: number): Promise<Post | null> => { await dbNotConfiguredError(); return null; };
  addCommentDb = async (commentData: NewComment): Promise<Comment> => { await dbNotConfiguredError(); return null as any; };
  getCommentsByPostIdDb = async (postId: number): Promise<Comment[]> => { console.warn("MOCK DB: getCommentsByPostIdDb called"); return []; };
  incrementAndGetVisitorCountsDb = async (): Promise<VisitorCounts> => { console.warn("MOCK DB: incrementAndGetVisitorCountsDb called"); return { totalVisits: 0, dailyVisits: 0 }; };
  getVisitorCountsDb = async (): Promise<VisitorCounts> => { console.warn("MOCK DB: getVisitorCountsDb called"); return { totalVisits: 0, dailyVisits: 0 }; };
  addOrUpdateDeviceTokenDb = async (token: string, latitude?: number, longitude?: number): Promise<void> => { console.warn("MOCK DB: addOrUpdateDeviceTokenDb called"); return; };
  getNearbyDeviceTokensDb = async (latitude: number, longitude: number, radiusKm: number = 10): Promise<string[]> => { console.warn("MOCK DB: getNearbyDeviceTokensDb called"); return []; };
  deleteDeviceTokenDb = async (token: string): Promise<void> => { console.warn("MOCK DB: deleteDeviceTokenDb called"); return; };
  getNewerPostsCountDb = async (latestIdKnown: number): Promise<number> => { console.warn("MOCK DB: getNewerPostsCountDb called"); return 0; };
  closeDb = async (): Promise<void> => { console.warn("MOCK DB: closeDb called"); return; };

  // Mock User functions
  createUserDb = async (newUser: NewUser): Promise<User> => { await dbNotConfiguredError(); return null as any; };
  getUserByEmailDb = async (email: string): Promise<UserWithPassword | null> => { await dbNotConfiguredError(); return null; };
  getUserByIdDb = async (id: number): Promise<User | null> => { await dbNotConfiguredError(); return null; };
  getPostsByUserIdDb = async (userId: number): Promise<Post[]> => { console.warn("MOCK DB: getPostsByUserIdDb called for user", userId); return []; };
  getPendingUsersDb = async (): Promise<User[]> => { console.warn("MOCK DB: getPendingUsersDb called"); return []; };
  updateUserStatusDb = async (userId: number, status: 'approved' | 'rejected'): Promise<User | null> => { await dbNotConfiguredError(); return null; };
  getAllUsersDb = async (): Promise<User[]> => { console.warn("MOCK DB: getAllUsersDb called"); return []; };


} else {
  // --- REAL DATABASE IMPLEMENTATIONS ---

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  pool.on('connect', () => { console.log('PostgreSQL connected'); });
  pool.on('error', (err) => { console.error('PostgreSQL client error:', err); });
  
  async function checkTableExists(client: any, tableName: string): Promise<boolean> {
    const res = await client.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`, [tableName]);
    return res.rows[0].exists;
  }
  
  async function initializeDatabaseSchema(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Users Table
      const usersTableExists = await checkTableExists(client, 'users');
      if (!usersTableExists) { console.log('Users table does not exist. Creating...'); }
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Checked/Created users table.');
  
      // Posts Table
      const postsTableExists = await checkTableExists(client, 'posts');
      if (!postsTableExists) { console.log('Posts table does not exist. Creating...'); }
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
      // Add authorId to posts table if it doesn't exist
       if (postsTableExists) {
          const hasAuthorId = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='authorid');`);
          if (!hasAuthorId.rows[0].exists) {
            await client.query('ALTER TABLE posts ADD COLUMN authorId INTEGER REFERENCES users(id) ON DELETE SET NULL;');
            console.log('Added authorId column to posts table.');
          }
      } else {
        // If table is new, we still need to add the column after creation if not in the initial CREATE
        await client.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS authorId INTEGER REFERENCES users(id) ON DELETE SET NULL;');
      }
      console.log('Checked/Created posts table structure.');
  
      // Comments Table
      const commentsTableExists = await checkTableExists(client, 'comments');
      if (!commentsTableExists) { console.log('Comments table does not exist. Creating...'); }
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
  
      // Visitor Stats Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS visitor_stats (
          stat_name VARCHAR(255) PRIMARY KEY,
          stat_value TEXT NULL
        );
      `);
      console.log('Checked/Created visitor_stats table.');
  
      // Device Tokens Table
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

      // Add indexes for performance
      console.log('Creating indexes for performance...');
      await client.query('CREATE INDEX IF NOT EXISTS idx_posts_authorid ON posts (authorid);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_posts_createdat ON posts (createdat DESC);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_comments_postid ON comments (postid);');
      console.log('Indexes created.');
  
      const todayStr = new Date().toISOString().split('T')[0];
      await client.query("INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('total_visits', '0') ON CONFLICT (stat_name) DO NOTHING");
      await client.query("INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_date', $1) ON CONFLICT (stat_name) DO UPDATE SET stat_value = EXCLUDED.stat_value WHERE visitor_stats.stat_name = 'daily_visits_date' AND (visitor_stats.stat_value IS NULL OR visitor_stats.stat_value != EXCLUDED.stat_value)", [todayStr]);
      await client.query("INSERT INTO visitor_stats (stat_name, stat_value) VALUES ('daily_visits_count', '0') ON CONFLICT (stat_name) DO NOTHING");
      console.log('Initialized/Verified visitor_stats data.');
      
      await client.query('COMMIT');
      console.log('Database schema initialization complete.');
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Failed to initialize database schema', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  initializeDatabaseSchema().catch(err => { console.error("Critical: Failed to initialize DB schema on startup.", err); });
  
  // USER FUNCTIONS
  createUserDb = async (newUser: NewUser): Promise<User> => {
    const passwordHash = await bcrypt.hash(newUser.passwordplaintext, 10);
    const result: QueryResult<User> = await pool.query(
      'INSERT INTO users (name, email, passwordHash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, status, createdAt',
      [newUser.name, newUser.email.toLowerCase(), passwordHash, newUser.role]
    );
    return result.rows[0];
  }

  getUserByEmailDb = async (email: string): Promise<UserWithPassword | null> => {
    const result: QueryResult<UserWithPassword> = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  getUserByIdDb = async (id: number): Promise<User | null> => {
    const result: QueryResult<User> = await pool.query(
      'SELECT id, name, email, role, status, createdAt FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  getPostsByUserIdDb = async (userId: number): Promise<Post[]> => {
    try {
        const queryText = `
        SELECT p.id, p.content, p.latitude, p.longitude, p.createdAt, p.mediaUrl, p.mediaType, p.likeCount, p.city, p.hashtags,
                u.id as authorId, u.name as authorName, u.role as authorRole
        FROM posts p
        JOIN users u ON p.authorId = u.id
        WHERE p.authorId = $1 AND u.status = 'approved'
        ORDER BY p.createdAt DESC
        `;
        const result: QueryResult<Post> = await pool.query(queryText, [userId]);
        return result.rows;
    } catch (error) {
        console.error(`Error fetching posts for user ${userId} from DB:`, error);
        throw error;
    }
  }

  getPendingUsersDb = async (): Promise<User[]> => {
    const result: QueryResult<User> = await pool.query(
      "SELECT id, name, email, role, status, createdAt FROM users WHERE status = 'pending' ORDER BY createdAt ASC"
    );
    return result.rows;
  }
  
  updateUserStatusDb = async (userId: number, status: 'approved' | 'rejected'): Promise<User | null> => {
    const result: QueryResult<User> = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, role, status, createdAt',
      [status, userId]
    );
    return result.rows[0] || null;
  }

  getAllUsersDb = async (): Promise<User[]> => {
    const result: QueryResult<User> = await pool.query(
        'SELECT id, name, email, role, status, createdAt FROM users ORDER BY createdAt DESC'
    );
    return result.rows;
  }

  
  // POST FUNCTIONS
  getPostsDb = async (options?: { limit: number; offset: number }, userRole?: UserRole): Promise<Post[]> => {
    try {
      const selectClause = `
        SELECT p.id, p.content, p.latitude, p.longitude, p.createdAt, p.mediaUrl, p.mediaType, p.likeCount, p.city, p.hashtags,
               u.id as authorId, u.name as authorName, u.role as authorRole
        FROM posts p
        LEFT JOIN users u ON p.authorId = u.id
      `;
      const whereClause = `WHERE (u.status = 'approved' OR p.authorId IS NULL)`;
      
      let orderByClause = 'ORDER BY p.createdAt DESC';
      if (userRole === 'Gorakshak') {
        orderByClause = `ORDER BY CASE WHEN u.role = 'Gorakshak' THEN 0 ELSE 1 END, p.createdAt DESC`;
      }
      
      let queryText = `${selectClause} ${whereClause} ${orderByClause}`;
      const queryParams: number[] = [];

      if (options?.limit) {
          queryParams.push(options.limit);
          queryText += ` LIMIT $${queryParams.length}`;
      }
      if (options?.offset) {
          queryParams.push(options.offset);
          queryText += ` OFFSET $${queryParams.length}`;
      }
      
      const result: QueryResult<Post> = await pool.query(queryText, queryParams);
      return result.rows;
    } catch (error) {
      console.error("Error fetching posts from DB:", error);
      throw error;
    }
  }

  getMediaPostsDb = async (options?: { limit: number; offset: number; }): Promise<Post[]> => {
    try {
      let queryText = `
        SELECT p.id, p.content, p.latitude, p.longitude, p.createdAt, p.mediaUrl, p.mediaType, p.likeCount, p.city, p.hashtags,
               u.id as authorId, u.name as authorName, u.role as authorRole
        FROM posts p
        LEFT JOIN users u ON p.authorId = u.id
        WHERE (p.mediaurl IS NOT NULL AND (p.mediatype = 'image' OR p.mediatype = 'video'))
        AND (u.status = 'approved' OR p.authorId IS NULL)
        ORDER BY p.createdAt DESC`;
      const queryParams: number[] = [];

      if (options?.limit) {
          queryParams.push(options.limit);
          queryText += ` LIMIT $${queryParams.length}`;
      }

      if (options?.offset) {
          queryParams.push(options.offset);
          queryText += ` OFFSET $${queryParams.length}`;
      }
      
      const result: QueryResult<Post> = await pool.query(queryText, queryParams);
      return result.rows;
    } catch (error) {
      console.error("Error fetching media posts from DB:", error);
      throw error;
    }
  }
  
  addPostDb = async (newPost: DbNewPost): Promise<Post> => {
    try {
      const result: QueryResult<Post> = await pool.query(
        'INSERT INTO posts (content, latitude, longitude, mediaUrl, mediaType, city, hashtags, authorId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, content, latitude, longitude, createdAt, mediaUrl, mediaType, likeCount, city, hashtags, authorId',
        [
          newPost.content, newPost.latitude, newPost.longitude, 
          newPost.mediaurl ?? null, newPost.mediatype ?? null, 
          newPost.city ?? null, newPost.hashtags ?? null, newPost.authorid
        ]
      );
      const insertedPost = result.rows[0];
      if (!insertedPost) throw new Error('Failed to retrieve the newly inserted post.');
      return insertedPost;
    } catch (error: any) {
      console.error('Error adding post to database:', error);
      throw new Error(`Database operation failed for addPostDb: ${error.message}`);
    }
  }
  
  incrementPostLikeCountDb = async (postId: number): Promise<Post | null> => {
    try {
      const updateResult: QueryResult<Post> = await pool.query('UPDATE posts SET likeCount = likeCount + 1 WHERE id = $1 RETURNING *', [postId]);
      return updateResult.rows[0] || null;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to increment like count in DB.');
    }
  }
  
  
  addCommentDb = async (commentData: NewComment): Promise<Comment> => {
    try {
      const result: QueryResult<Comment> = await pool.query('INSERT INTO comments (postId, author, content) VALUES ($1, $2, $3) RETURNING *', [commentData.postId, commentData.author, commentData.content]);
      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Database operation failed for addCommentDb: ${error.message}`);
    }
  }
  
  getCommentsByPostIdDb = async (postId: number): Promise<Comment[]> => {
    try {
      const result: QueryResult<Comment> = await pool.query('SELECT * FROM comments WHERE postId = $1 ORDER BY createdAt ASC', [postId]);
      return result.rows;
    } catch (error) {
      console.error(`Error fetching comments for post ${postId} from DB:`, error);
      return [];
    }
  }
  
  incrementAndGetVisitorCountsDb = async (): Promise<VisitorCounts> => {
      const todayStr = new Date().toISOString().split('T')[0];
      const client = await pool.connect();
      try {
          await client.query('BEGIN');
          const totalUpdateResult = await client.query<{ stat_value: string }>("UPDATE visitor_stats SET stat_value = (COALESCE(stat_value, '0')::INTEGER + 1)::TEXT WHERE stat_name = 'total_visits' RETURNING stat_value");
          const totalVisits = parseInt(totalUpdateResult.rows[0]?.stat_value || '0', 10);
          const dailyDateRow = await client.query<{ stat_value: string }>("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'");
          let dailyVisits: number;
          if (dailyDateRow.rows[0]?.stat_value === todayStr) {
              const dailyUpdateResult = await client.query<{ stat_value: string }>("UPDATE visitor_stats SET stat_value = (COALESCE(stat_value, '0')::INTEGER + 1)::TEXT WHERE stat_name = 'daily_visits_count' RETURNING stat_value");
              dailyVisits = parseInt(dailyUpdateResult.rows[0]?.stat_value || '0', 10);
          } else {
              await client.query("UPDATE visitor_stats SET stat_value = $1 WHERE stat_name = 'daily_visits_date'", [todayStr]);
              await client.query("UPDATE visitor_stats SET stat_value = '1' WHERE stat_name = 'daily_visits_count'");
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
  
  getVisitorCountsDb = async (): Promise<VisitorCounts> => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const totalRowResult = await pool.query<{ stat_value: string }>("SELECT stat_value FROM visitor_stats WHERE stat_name = 'total_visits'");
      const totalVisits = parseInt(totalRowResult.rows[0]?.stat_value || '0', 10);
      const dailyDateRowResult = await pool.query<{ stat_value: string }>("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_date'");
      let dailyVisits = 0;
      if (dailyDateRowResult.rows[0]?.stat_value === todayStr) {
        const dailyCountRowResult = await pool.query<{ stat_value: string }>("SELECT stat_value FROM visitor_stats WHERE stat_name = 'daily_visits_count'");
        dailyVisits = parseInt(dailyCountRowResult.rows[0]?.stat_value || '0', 10);
      }
      return { totalVisits, dailyVisits };
    } catch (error) {
      console.error('Error getting visitor counts from DB:', error);
      return { totalVisits: 0, dailyVisits: 0 };
    }
  }
  
  addOrUpdateDeviceTokenDb = async (token: string, latitude?: number, longitude?: number): Promise<void> => {
    try {
      await pool.query(`INSERT INTO device_tokens (token, latitude, longitude, last_updated) VALUES ($1, $2, $3, NOW()) ON CONFLICT (token) DO UPDATE SET latitude = COALESCE($2, device_tokens.latitude), longitude = COALESCE($3, device_tokens.longitude), last_updated = NOW()`, [token, latitude, longitude]);
    } catch (error) {
      console.error('Error adding/updating device token in DB:', error);
      throw new Error('Failed to save device token.');
    }
  }

  deleteDeviceTokenDb = async (token: string): Promise<void> => {
    try {
      await pool.query('DELETE FROM device_tokens WHERE token = $1', [token]);
    } catch (error) {
        console.error(`Error deleting device token from DB:`, error);
    }
  }
  
  getNearbyDeviceTokensDb = async (latitude: number, longitude: number, radiusKm: number = 10): Promise<string[]> => {
    try {
      const latDelta = radiusKm / 111.0;
      const lonDelta = radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180));
      const result: QueryResult<{ token: string }> = await pool.query(
        `SELECT token FROM device_tokens WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
        [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
      );
      return result.rows.map(row => row.token);
    } catch (error) {
      console.error('Error fetching nearby device tokens from DB:', error);
      return [];
    }
  }
  
  getNewerPostsCountDb = async (latestIdKnown: number): Promise<number> => {
    try {
      const result: QueryResult<{ count: string }> = await pool.query('SELECT COUNT(*) FROM posts WHERE id > $1', [latestIdKnown]);
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
  
  const cleanup = async () => { await closeDb(); process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Export the functions
export {
  getPostsDb, getMediaPostsDb, addPostDb, incrementPostLikeCountDb,
  addCommentDb, getCommentsByPostIdDb, incrementAndGetVisitorCountsDb,
  getVisitorCountsDb, addOrUpdateDeviceTokenDb, deleteDeviceTokenDb,
  getNearbyDeviceTokensDb, getNewerPostsCountDb, closeDb,
  // User functions
  createUserDb, getUserByEmailDb, getUserByIdDb, getPostsByUserIdDb, getPendingUsersDb, updateUserStatusDb, getAllUsersDb
};
