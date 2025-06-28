
import { Pool, type QueryResult } from 'pg';
import type { Post, DbNewPost, Comment, NewComment, VisitorCounts, DeviceToken, User, UserWithPassword, NewUser, UserRole, UpdatableUserFields, UserFollowStats } from './db-types';
import bcrypt from 'bcryptjs';

// Re-export db-types
export * from './db-types';

let pool: Pool | null = null;
let dbWarningShown = false;

// --- Database Connection and Initialization ---

function getDbPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    if (!dbWarningShown) {
      console.warn("----------------------------------------------------------------");
      console.warn("WARNING: POSTGRES_URL is not set. Database features will be disabled.");
      console.warn("The app will run in a no-database mode, returning empty data for queries.");
      console.warn("Please create a .env.local file and set POSTGRES_URL to enable database functionality.");
      console.warn("Refer to the README.md file for instructions.");
      console.warn("----------------------------------------------------------------");
      dbWarningShown = true;
    }
    return null;
  }
  
  pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10, // Max number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
  });
  console.log('PostgreSQL pool created. Ready to connect.');
  
  return pool;
}

// Function to initialize the database schema
async function initializeDbSchema(): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) {
    console.log("Skipping DB schema initialization: POSTGRES_URL is not set.");
    return;
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordhash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('Business', 'Gorakshak', 'Admin', 'Janta')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add profilepictureurl column if it doesn't exist
    const profilePicColRes = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='profilepictureurl';
    `);
    if (profilePicColRes.rowCount === 0) {
      await client.query('ALTER TABLE users ADD COLUMN profilepictureurl TEXT;');
    }
    
    // Posts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        mediaurl TEXT,
        mediatype VARCHAR(10) CHECK (mediatype IN ('image', 'video')),
        likecount INTEGER DEFAULT 0,
        viewcount INTEGER DEFAULT 0,
        notifiedcount INTEGER DEFAULT 0,
        city VARCHAR(255),
        hashtags TEXT[],
        authorid INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Post Likes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      );
    `);


    // Comments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        postid INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
        author VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // User Followers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_followers (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, following_id)
      );
    `);

    // Post Mentions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_mentions (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, mentioned_user_id)
      );
    `);


    // Visitor Stats Table - Robust check to prevent transaction errors
    const tableExistsRes = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'visitor_stats'
        );
    `);
    const tableExists = tableExistsRes.rows[0].exists;

    let tableIsCorrect = false;
    if (tableExists) {
      await client.query('SAVEPOINT check_stats_columns');
      try {
          const columnsRes = await client.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns
              WHERE table_name = 'visitor_stats'
              AND column_name IN ('stat_key', 'value');
          `);
          const hasStatKey = columnsRes.rows.some(r => r.column_name === 'stat_key');
          const hasValue = columnsRes.rows.some(r => r.column_name === 'value' && r.data_type === 'bigint');
          if (hasStatKey && hasValue && columnsRes.rows.length === 2) {
              tableIsCorrect = true;
          }
          await client.query('RELEASE SAVEPOINT check_stats_columns');
      } catch(e) {
          // This will catch errors like "column does not exist"
          await client.query('ROLLBACK TO SAVEPOINT check_stats_columns');
          console.warn("`visitor_stats` table check failed. It will be recreated.");
          tableIsCorrect = false;
      }
    }

    if (!tableIsCorrect) {
        console.warn("`visitor_stats` table is missing or malformed. It will be recreated.");
        await client.query("DROP TABLE IF EXISTS visitor_stats;");
        await client.query(`
            CREATE TABLE visitor_stats (
                stat_key VARCHAR(255) PRIMARY KEY,
                value BIGINT NOT NULL
            );
        `);
    }

    // This query is now safe to run whether the table was pre-existing or just created
    await client.query(`
      INSERT INTO visitor_stats (stat_key, value)
      VALUES ('total_visits', 0), ('daily_visits_date', 0), ('daily_visits_count', 0)
      ON CONFLICT (stat_key) DO NOTHING;
    `);

    // Device Tokens Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        latitude REAL,
        longitude REAL,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Indexes for performance ---
    await client.query('CREATE INDEX IF NOT EXISTS idx_posts_createdat ON posts (createdat DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_posts_authorid ON posts (authorid)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_comments_postid ON comments (postid)');
    await client.query('CREATE EXTENSION IF NOT EXISTS cube');
    await client.query('CREATE EXTENSION IF NOT EXISTS earthdistance');
    await client.query('CREATE INDEX IF NOT EXISTS posts_geo_idx ON posts USING gist (ll_to_earth(latitude, longitude))');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_media ON posts (createdat DESC) WHERE mediaurl IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role, id)`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes (user_id, post_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON user_followers (follower_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_followers_following_id ON user_followers (following_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions (post_id)');


    await client.query('COMMIT');
    console.log('Database schema initialized successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database schema', err);
    throw new Error(`Critical: Failed to initialize DB schema on startup. ${err.message}`);
  } finally {
    client.release();
  }
}

// Run initialization
if (process.env.NODE_ENV !== 'test') {
    initializeDbSchema().catch(console.error);
}


// --- Function Implementations ---

export async function getPostsDb(options: { limit: number; offset: number } = { limit: 10, offset: 0 }, userRole?: UserRole): Promise<Post[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const postIdsQuery = `
      SELECT id FROM posts 
      ORDER BY createdat DESC 
      LIMIT $1 OFFSET $2
    `;
    const postIdsResult = await client.query(postIdsQuery, [options.limit, options.offset]);
    const postIds = postIdsResult.rows.map(row => row.id);

    if (postIds.length === 0) {
      return [];
    }

    const postsQuery = `
      SELECT p.*, u.name as authorname, u.role as authorrole, u.profilepictureurl as authorprofilepictureurl
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.id = ANY($1::int[])
      ORDER BY p.createdat DESC
    `;
    const postsResult = await client.query(postsQuery, [postIds]);
    return postsResult.rows;
  } finally {
    client.release();
  }
}

export async function getMediaPostsDb(options: { limit: number; offset: number; } = { limit: 10, offset: 0 }): Promise<Post[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const postIdsQuery = `
      SELECT id FROM posts 
      WHERE mediaurl IS NOT NULL 
      ORDER BY createdat DESC 
      LIMIT $1 OFFSET $2
    `;
    const postIdsResult = await client.query(postIdsQuery, [options.limit, options.offset]);
    const postIds = postIdsResult.rows.map(row => row.id);

    if (postIds.length === 0) {
      return [];
    }

    const postsQuery = `
      SELECT p.*, u.name as authorname, u.role as authorrole, u.profilepictureurl as authorprofilepictureurl
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.id = ANY($1::int[])
      ORDER BY p.createdat DESC
    `;
    const postsResult = await client.query(postsQuery, [postIds]);
    return postsResult.rows;
  } finally {
    client.release();
  }
}

export async function addPostDb(newPost: DbNewPost): Promise<Post> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot add post.");

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const postQuery = `
      INSERT INTO posts(content, latitude, longitude, mediaurl, mediatype, hashtags, city, authorid)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const postValues = [newPost.content, newPost.latitude, newPost.longitude, newPost.mediaurl, newPost.mediatype, newPost.hashtags, newPost.city, newPost.authorid];
    const postResult: QueryResult<Post> = await client.query(postQuery, postValues);
    const addedPost = postResult.rows[0];

    if (newPost.mentionedUserIds && newPost.mentionedUserIds.length > 0) {
      const mentionQuery = 'INSERT INTO post_mentions (post_id, mentioned_user_id) SELECT $1, unnest($2::int[])';
      await client.query(mentionQuery, [addedPost.id, newPost.mentionedUserIds]);
    }
    
    await client.query('COMMIT');
    return addedPost;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePostDb(postId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'DELETE FROM posts WHERE id = $1';
  await dbPool.query(query, [postId]);
}


export async function updatePostLikeCountDb(postId: number, direction: 'increment' | 'decrement'): Promise<Post | null> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot update like count.");
  const operator = direction === 'increment' ? '+' : '-';
  const query = `
    UPDATE posts
    SET likecount = likecount ${operator} 1
    WHERE id = $1 AND likecount >= 0
    RETURNING *;
  `;
  const result: QueryResult<Post> = await dbPool.query(query, [postId]);
  return result.rows[0] || null;
}

export async function addCommentDb(commentData: NewComment): Promise<Comment> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot add comment.");
  
  const query = `
    INSERT INTO comments(postid, author, content)
    VALUES($1, $2, $3)
    RETURNING *;
  `;
  const values = [commentData.postId, commentData.author, commentData.content];
  const result: QueryResult<Comment> = await dbPool.query(query, values);
  return result.rows[0];
}

export async function getCommentsByPostIdDb(postId: number): Promise<Comment[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const query = `
    SELECT * FROM comments
    WHERE postid = $1
    ORDER BY createdat DESC;
  `;
  const result: QueryResult<Comment> = await dbPool.query(query, [postId]);
  return result.rows;
}

export async function incrementAndGetVisitorCountsDb(): Promise<VisitorCounts> {
  const dbPool = getDbPool();
  if (!dbPool) return { totalVisits: 0, dailyVisits: 0 };
  
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const totalVisitsRes = await client.query("UPDATE visitor_stats SET value = value + 1 WHERE stat_key = 'total_visits' RETURNING value");
    const totalVisits = totalVisitsRes.rows[0].value;
    
    const dateRes = await client.query("SELECT value FROM visitor_stats WHERE stat_key = 'daily_visits_date'");
    const today = new Date().setHours(0, 0, 0, 0);
    let dailyVisits;

    if (dateRes.rows[0].value !== today) {
      await client.query("UPDATE visitor_stats SET value = $1 WHERE stat_key = 'daily_visits_date'", [today]);
      const dailyVisitsRes = await client.query("UPDATE visitor_stats SET value = 1 WHERE stat_key = 'daily_visits_count' RETURNING value");
      dailyVisits = dailyVisitsRes.rows[0].value;
    } else {
      const dailyVisitsRes = await client.query("UPDATE visitor_stats SET value = value + 1 WHERE stat_key = 'daily_visits_count' RETURNING value");
      dailyVisits = dailyVisitsRes.rows[0].value;
    }
    
    await client.query('COMMIT');
    return { totalVisits, dailyVisits };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getVisitorCountsDb(): Promise<VisitorCounts> {
  const dbPool = getDbPool();
  if (!dbPool) return { totalVisits: 0, dailyVisits: 0 };
  
  const totalVisitsRes = await dbPool.query("SELECT value FROM visitor_stats WHERE stat_key = 'total_visits'");
  const dailyVisitsRes = await dbPool.query("SELECT value FROM visitor_stats WHERE stat_key = 'daily_visits_count'");
  
  const dateRes = await dbPool.query("SELECT value FROM visitor_stats WHERE stat_key = 'daily_visits_date'");
  const today = new Date().setHours(0, 0, 0, 0);
  let dailyVisits = dailyVisitsRes.rows[0]?.value || 0;

  if (dateRes.rows[0]?.value !== today) {
     await dbPool.query("UPDATE visitor_stats SET value = 0 WHERE stat_key = 'daily_visits_count'");
     dailyVisits = 0;
  }

  return {
    totalVisits: totalVisitsRes.rows[0]?.value || 0,
    dailyVisits: dailyVisits,
  };
}

export async function addOrUpdateDeviceTokenDb(token: string, latitude?: number, longitude?: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) return;

  const query = `
    INSERT INTO device_tokens (token, latitude, longitude, last_updated)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (token) DO UPDATE 
      SET latitude = EXCLUDED.latitude, 
          longitude = EXCLUDED.longitude,
          last_updated = NOW();
  `;
  await dbPool.query(query, [token, latitude, longitude]);
}

export async function getNearbyDeviceTokensDb(latitude: number, longitude: number, radiusKm: number = 20): Promise<string[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const query = `
    SELECT token FROM device_tokens
    WHERE earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth(latitude, longitude)
    AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) < $3 * 1000;
  `;
  const result: QueryResult<{token: string}> = await dbPool.query(query, [latitude, longitude, radiusKm]);
  return result.rows.map(row => row.token);
}

export async function deleteDeviceTokenDb(token: string): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) return;
  await dbPool.query('DELETE FROM device_tokens WHERE token = $1', [token]);
}

export async function getNewerPostsCountDb(latestIdKnown: number): Promise<number> {
  const dbPool = getDbPool();
  if (!dbPool) return 0;

  const query = 'SELECT COUNT(*) FROM posts WHERE id > $1';
  const result = await dbPool.query(query, [latestIdKnown]);
  return parseInt(result.rows[0].count, 10);
}

export async function getPostByIdDb(postId: number, userRole?: UserRole): Promise<Post | null> {
  const dbPool = getDbPool();
  if (!dbPool) return null;

  const query = `
    SELECT p.*, u.name as authorname, u.role as authorrole, u.profilepictureurl as authorprofilepictureurl
    FROM posts p
    LEFT JOIN users u ON p.authorid = u.id
    WHERE p.id = $1;
  `;
  const result: QueryResult<Post> = await dbPool.query(query, [postId]);
  return result.rows[0] || null;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL pool has ended');
    pool = null;
  }
}

export async function incrementPostViewCountDb(postId: number): Promise<void> {
    const dbPool = getDbPool();
    if (!dbPool) return;
    await dbPool.query('UPDATE posts SET viewcount = viewcount + 1 WHERE id = $1', [postId]);
}

export async function updateNotifiedCountDb(postId: number, count: number): Promise<void> {
    const dbPool = getDbPool();
    if (!dbPool) return;
    await dbPool.query('UPDATE posts SET notifiedcount = $1 WHERE id = $2', [count, postId]);
}

// --- User & Like Functions ---

export async function checkIfUserLikedPostDb(userId: number, postId: number): Promise<boolean> {
  const dbPool = getDbPool();
  if (!dbPool) return false;
  const query = 'SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2';
  const result = await dbPool.query(query, [userId, postId]);
  return result.rowCount > 0;
}

export async function addLikeDb(userId: number, postId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
  await dbPool.query(query, [userId, postId]);
}

export async function removeLikeDb(userId: number, postId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2';
  await dbPool.query(query, [userId, postId]);
}

export async function getLikedPostIdsForUserDb(userId: number, postIds: number[]): Promise<Set<number>> {
  const dbPool = getDbPool();
  if (!dbPool || postIds.length === 0) return new Set();

  const query = `
    SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::int[])
  `;
  const result = await dbPool.query(query, [userId, postIds]);
  return new Set(result.rows.map(r => r.post_id));
}

export async function createUserDb(newUser: NewUser, status: 'pending' | 'approved' = 'pending'): Promise<User> {
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured. Cannot create user.");
    
    const salt = await bcrypt.genSalt(10);
    const passwordhash = await bcrypt.hash(newUser.passwordplaintext, salt);
    
    const query = `
        INSERT INTO users(name, email, passwordhash, role, status)
        VALUES($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, status, createdat, profilepictureurl;
    `;
    const values = [newUser.name, newUser.email, passwordhash, newUser.role, status];
    const result: QueryResult<User> = await dbPool.query(query, values);
    return result.rows[0];
}

export async function getUserByEmailDb(email: string): Promise<UserWithPassword | null> {
    const dbPool = getDbPool();
    if (!dbPool) return null;
    
    const query = 'SELECT * FROM users WHERE email = $1';
    const result: QueryResult<UserWithPassword> = await dbPool.query(query, [email]);
    return result.rows[0] || null;
}

export async function getUserByIdDb(id: number): Promise<User | null> {
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const query = 'SELECT id, email, name, role, status, createdat, profilepictureurl FROM users WHERE id = $1';
    const result: QueryResult<User> = await dbPool.query(query, [id]);
    return result.rows[0] || null;
}

export async function updateUserProfilePictureDb(userId: number, imageUrl: string): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'UPDATE users SET profilepictureurl = $1 WHERE id = $2';
  await dbPool.query(query, [imageUrl, userId]);
}


export async function getPostsByUserIdDb(userId: number): Promise<Post[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const query = `
    SELECT p.*, u.name as authorname, u.role as authorrole, u.profilepictureurl as authorprofilepictureurl
    FROM posts p
    JOIN users u ON p.authorid = u.id
    WHERE p.authorid = $1
    ORDER BY p.createdat DESC;
  `;
  const result: QueryResult<Post> = await dbPool.query(query, [userId]);
  return result.rows;
}

export async function getPendingUsersDb(): Promise<User[]> {
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const query = `
        SELECT id, name, email, role, status, createdat, profilepictureurl
        FROM users 
        WHERE status = 'pending'
        ORDER BY createdat ASC;
    `;
    const result: QueryResult<User> = await dbPool.query(query);
    return result.rows;
}

export async function getAllUsersDb(): Promise<User[]> {
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const query = `
        SELECT id, name, email, role, status, createdat, profilepictureurl
        FROM users 
        ORDER BY createdat DESC;
    `;
    const result: QueryResult<User> = await dbPool.query(query);
    return result.rows;
}

export async function updateUserStatusDb(userId: number, status: 'approved' | 'rejected'): Promise<User | null> {
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured. Cannot update user status.");

    const query = `
        UPDATE users
        SET status = $1
        WHERE id = $2
        RETURNING id, name, email, role, status, createdat, profilepictureurl;
    `;
    const result: QueryResult<User> = await dbPool.query(query, [status, userId]);
    return result.rows[0] || null;
}

export async function updateUserDb(userId: number, userData: UpdatableUserFields): Promise<User | null> {
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const query = `
      UPDATE users
      SET name = $1, email = $2, role = $3, status = $4
      WHERE id = $5
      RETURNING id, name, email, role, status, createdat, profilepictureurl;
    `;
    const values = [userData.name, userData.email, userData.role, userData.status, userId];
    const result: QueryResult<User> = await dbPool.query(query, values);
    return result.rows[0] || null;
}

export async function deleteUserDb(userId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'DELETE FROM users WHERE id = $1';
  await dbPool.query(query, [userId]);
}

// --- Follower Functions ---

export async function followUserDb(followerId: number, followingId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'INSERT INTO user_followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
  await dbPool.query(query, [followerId, followingId]);
}

export async function unfollowUserDb(followerId: number, followingId: number): Promise<void> {
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const query = 'DELETE FROM user_followers WHERE follower_id = $1 AND following_id = $2';
  await dbPool.query(query, [followerId, followingId]);
}

export async function getFollowerCountsDb(userId: number): Promise<UserFollowStats> {
  const dbPool = getDbPool();
  if (!dbPool) return { followerCount: 0, followingCount: 0 };
  
  const followerQuery = 'SELECT COUNT(*) FROM user_followers WHERE following_id = $1';
  const followingQuery = 'SELECT COUNT(*) FROM user_followers WHERE follower_id = $1';

  const [followerResult, followingResult] = await Promise.all([
    dbPool.query(followerQuery, [userId]),
    dbPool.query(followingQuery, [userId]),
  ]);

  return {
    followerCount: parseInt(followerResult.rows[0].count, 10),
    followingCount: parseInt(followingResult.rows[0].count, 10),
  };
}

export async function checkIfUserIsFollowingDb(followerId: number, followingId: number): Promise<boolean> {
  const dbPool = getDbPool();
  if (!dbPool) return false;
  const query = 'SELECT 1 FROM user_followers WHERE follower_id = $1 AND following_id = $2';
  const result = await dbPool.query(query, [followerId, followingId]);
  return result.rowCount > 0;
}

// --- Mention Functions ---

export async function searchUsersDb(query: string, currentUserId?: number): Promise<User[]> {
  const dbPool = getDbPool();
  if (!dbPool) return [];
  
  const sqlQuery = `
    SELECT id, name, email, role, status, createdat, profilepictureurl 
    FROM users 
    WHERE name ILIKE $1 
      AND status = 'approved'
      AND ($2::int IS NULL OR id != $2::int)
    LIMIT 10;
  `;
  const result: QueryResult<User> = await dbPool.query(sqlQuery, [`%${query}%`, currentUserId]);
  return result.rows;
}

export async function getMentionsForPostsDb(postIds: number[]): Promise<Map<number, { id: number; name: string }[]>> {
  const dbPool = getDbPool();
  if (!dbPool || postIds.length === 0) return new Map();

  const query = `
    SELECT pm.post_id, u.id, u.name
    FROM post_mentions pm
    JOIN users u ON pm.mentioned_user_id = u.id
    WHERE pm.post_id = ANY($1::int[]);
  `;
  const result = await dbPool.query(query, [postIds]);

  const mentionsMap = new Map<number, { id: number; name: string }[]>();
  for (const row of result.rows) {
    const { post_id, id, name } = row;
    if (!mentionsMap.has(post_id)) {
      mentionsMap.set(post_id, []);
    }
    mentionsMap.get(post_id)!.push({ id, name });
  }
  return mentionsMap;
}
