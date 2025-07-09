
import { Pool, Client, type QueryResult } from 'pg';
import type { Post, DbNewPost, Comment, NewComment, VisitorCounts, DeviceToken, User, UserWithPassword, NewUser, UserRole, UpdatableUserFields, UserFollowStats, FollowUser, NewStatus, UserWithStatuses, Status, Conversation, Message, NewMessage, ConversationParticipant, FamilyRelationship, PendingFamilyRequest, FamilyMember, FamilyMemberLocation, SortOption, UpdateBusinessCategory, BusinessUser } from '@/lib/db-types';
import bcrypt from 'bcryptjs';

// Re-export db-types
export * from './db-types';

let pool: Pool | null = null;
let dbWarningShown = false;
let initializationPromise: Promise<void> | null = null;

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
      console.warn("Refer to the README.md for instructions.");
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
  
  return pool;
}

// Function to initialize the database schema.
// This uses a DEDICATED client instead of one from the pool to avoid blocking the pool during long initializations.
async function initializeDbSchema(): Promise<void> {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      // This case is handled by getDbPool, but good to be safe.
      return;
    }

    const initClient = new Client({
        connectionString,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
        await initClient.connect();
        console.log('Dedicated client connected for schema initialization...');
        await initClient.query('BEGIN');

        // Users Table
        await initClient.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            passwordhash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL CHECK (role IN ('Business', 'Gorakshak', 'Admin', 'Public(जनता)')),
            status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
            createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            profilepictureurl TEXT,
            mobilenumber VARCHAR(20),
            business_category TEXT,
            business_other_category TEXT,
            latitude REAL,
            longitude REAL
        );
        `);
        
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobilenumber VARCHAR(20);`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_category TEXT;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_other_category TEXT;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude REAL;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude REAL;`);

        
        // Posts Table
        await initClient.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            mediaurls TEXT[],
            mediatype VARCHAR(10) CHECK (mediatype IN ('image', 'video', 'gallery')),
            likecount INTEGER DEFAULT 0,
            commentcount INTEGER DEFAULT 0,
            viewcount INTEGER DEFAULT 0,
            notifiedcount INTEGER DEFAULT 0,
            city VARCHAR(255),
            hashtags TEXT[],
            authorid INTEGER REFERENCES users(id) ON DELETE SET NULL,
            is_family_post BOOLEAN DEFAULT false NOT NULL,
            hide_location BOOLEAN DEFAULT false NOT NULL
        );
        `);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_family_post BOOLEAN DEFAULT false NOT NULL;`);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_location BOOLEAN DEFAULT false NOT NULL;`);
        
        // Post Likes Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS post_likes ( id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, post_id));`);
        // Comments Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS comments ( id SERIAL PRIMARY KEY, postid INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL, author VARCHAR(255) NOT NULL, content TEXT NOT NULL, createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );`);
        // User Followers Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS user_followers ( follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (follower_id, following_id) );`);
        // Post Mentions Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS post_mentions ( post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (post_id, mentioned_user_id) );`);
        // Statuses Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS statuses ( id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_url TEXT NOT NULL, media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );`);
        // Device Tokens Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS device_tokens ( id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, latitude REAL, longitude REAL, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );`);
        // Visitor Stats Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS visitor_stats ( stat_key VARCHAR(255) PRIMARY KEY, value BIGINT NOT NULL );`);
        await initClient.query(`INSERT INTO visitor_stats (stat_key, value) VALUES ('total_visits', 0), ('daily_visits_date', 0), ('daily_visits_count', 0) ON CONFLICT (stat_key) DO NOTHING;`);
        // Chat Tables
        await initClient.query(`CREATE TABLE IF NOT EXISTS conversations ( id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );`);
        await initClient.query(`CREATE TABLE IF NOT EXISTS conversation_participants ( conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, unread_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (conversation_id, user_id) );`);
        await initClient.query(`CREATE TABLE IF NOT EXISTS messages ( id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );`);
        // Family Relationships Table
        await initClient.query(`
          CREATE TABLE IF NOT EXISTS family_relationships (
            id SERIAL PRIMARY KEY,
            user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT user_order_check CHECK (user_id_1 < user_id_2),
            UNIQUE (user_id_1, user_id_2)
          );
        `);
        // Add location sharing columns to family_relationships table if they don't exist
        await initClient.query(`ALTER TABLE family_relationships ADD COLUMN IF NOT EXISTS share_location_from_1_to_2 BOOLEAN NOT NULL DEFAULT false;`);
        await initClient.query(`ALTER TABLE family_relationships ADD COLUMN IF NOT EXISTS share_location_from_2_to_1 BOOLEAN NOT NULL DEFAULT false;`);


        // --- Indexes for performance ---
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_posts_createdat ON posts (createdat DESC)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_posts_authorid ON posts (authorid)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_comments_postid ON comments (postid)');
        await initClient.query('CREATE EXTENSION IF NOT EXISTS cube');
        await initClient.query('CREATE EXTENSION IF NOT EXISTS earthdistance');
        await initClient.query('CREATE INDEX IF NOT EXISTS posts_geo_idx ON posts USING gist (ll_to_earth(latitude, longitude))');
        await initClient.query(`CREATE INDEX IF NOT EXISTS idx_posts_media ON posts (createdat DESC) WHERE mediaurls IS NOT NULL AND array_length(mediaurls, 1) > 0 AND mediaurls[1] IS NOT NULL`);
        await initClient.query(`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role, id)`);
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes (user_id, post_id)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON user_followers (follower_id)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_followers_following_id ON user_followers (following_id)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions (post_id)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens (user_id);');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_statuses_user_id_created_at ON statuses (user_id, created_at DESC)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_statuses_created_at ON statuses (created_at DESC)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at DESC)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_family_relationships_user1 ON family_relationships(user_id_1)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_family_relationships_user2 ON family_relationships(user_id_2)');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_device_tokens_location ON device_tokens (user_id, last_updated DESC) WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_posts_is_family_post ON posts (is_family_post)');
        await initClient.query('CREATE INDEX IF NOT EXISTS users_geo_idx ON users USING gist (ll_to_earth(latitude, longitude)) WHERE role = \'Business\'');

        await initClient.query('COMMIT');
        console.log('Database schema initialized successfully via dedicated client.');

    } catch (err: any) {
        // We try to rollback, but it might fail if the connection is already lost.
        try { await initClient.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback failed:', rbErr); }
        console.error('Failed to initialize database schema', err);
        throw new Error(`Critical: Failed to initialize DB schema on startup. ${err.message}`);
    } finally {
        // Ensure the dedicated client connection is always closed.
        await initClient.end();
        console.log('Dedicated client for schema initialization has been disconnected.');
    }
}


// This function ensures that initialization is only attempted once.
function ensureDbInitialized() {
    if (!initializationPromise) {
        // Ensure the pool is created before we attempt initialization.
        getDbPool();
        console.log("Database not initialized, starting initialization...");
        initializationPromise = initializeDbSchema().catch(err => {
            initializationPromise = null;
            console.error("Database initialization failed. It will be retried on the next request.", err);
            throw err;
        });
    }
    return initializationPromise;
}


// --- Function Implementations ---

const POST_COLUMNS_SANITIZED = `
  p.id, p.content, p.latitude, p.longitude, p.createdat, p.likecount, 
  p.commentcount, p.viewcount, p.notifiedcount, p.city, p.hashtags, 
  p.is_family_post, p.hide_location, p.authorid, p.mediatype, p.mediaurls,
  u.name as authorname, u.role as authorrole,
  u.profilepictureurl as authorprofilepictureurl
`;

const USER_COLUMNS_SANITIZED = `
  id, email, name, role, status, createdat, profilepictureurl, mobilenumber, business_category, business_other_category, latitude, longitude
`;

export async function getPostsDb(
  options: { 
    limit: number; 
    offset: number;
    latitude?: number | null;
    longitude?: number | null;
    sortBy?: SortOption;
  } = { limit: 10, offset: 0, sortBy: 'newest' },
  userRole?: UserRole
): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    let orderByClause: string;
    const queryParams: (string | number)[] = [];
    const sortBy = options.sortBy || 'newest';

    let paramIndex = 1;

    let distanceCalc = '';
    if (options.latitude != null && options.longitude != null) {
        distanceCalc = `earth_distance(ll_to_earth(p.latitude, p.longitude), ll_to_earth($${paramIndex++}, $${paramIndex++}))`;
        queryParams.push(options.latitude, options.longitude);
    }
    
    if (sortBy === 'newest' && distanceCalc) {
      orderByClause = `
        CASE
          WHEN ${distanceCalc} < 20000 THEN 1
          WHEN ${distanceCalc} < 40000 THEN 2
          WHEN ${distanceCalc} < 60000 THEN 3
          WHEN ${distanceCalc} < 80000 THEN 4
          WHEN ${distanceCalc} < 100000 THEN 5
          ELSE 6
        END,
        p.createdat DESC
      `;
    } else {
      // Handle other sorts or default to createdat
      switch(sortBy) {
        case 'likes':
          orderByClause = 'p.likecount DESC, p.createdat DESC';
          break;
        case 'comments':
          orderByClause = 'p.commentcount DESC, p.createdat DESC';
          break;
        case 'newest':
        default:
          orderByClause = 'p.createdat DESC';
          break;
      }
    }

    const postsQuery = `
      SELECT ${POST_COLUMNS_SANITIZED}
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.is_family_post = false
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(options.limit, options.offset);

    const postsResult = await client.query(postsQuery, queryParams);
    return postsResult.rows;
  } finally {
    client.release();
  }
}

export async function getFamilyPostsDb(
    userId: number,
    options: { limit: number; offset: number; sortBy?: SortOption } = { limit: 10, offset: 0, sortBy: 'newest' }
): Promise<Post[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const sortBy = options.sortBy || 'newest';
        let orderByClause: string;
        
        switch(sortBy) {
          case 'likes':
            orderByClause = 'p.likecount DESC, p.createdat DESC';
            break;
          case 'comments':
            orderByClause = 'p.commentcount DESC, p.createdat DESC';
            break;
          case 'newest':
          default:
            orderByClause = 'p.createdat DESC';
            break;
        }

        const familyQuery = `
            SELECT ${POST_COLUMNS_SANITIZED}
            FROM posts p
            LEFT JOIN users u ON p.authorid = u.id
            WHERE p.is_family_post = TRUE
              AND (
                p.authorid = $1 OR
                p.authorid IN (
                    SELECT user_id_2 FROM family_relationships WHERE user_id_1 = $1 AND status = 'approved'
                    UNION
                    SELECT user_id_1 FROM family_relationships WHERE user_id_2 = $1 AND status = 'approved'
                )
              )
            ORDER BY ${orderByClause}
            LIMIT $2 OFFSET $3;
        `;
        const postsResult = await client.query(familyQuery, [userId, options.limit, options.offset]);
        return postsResult.rows;
    } finally {
        client.release();
    }
}


export async function getMediaPostsDb(options: { limit: number; offset: number; } = { limit: 10, offset: 0 }): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const postsQuery = `
      SELECT ${POST_COLUMNS_SANITIZED}
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE 
        p.is_family_post = false
        AND p.mediaurls IS NOT NULL 
        AND array_length(p.mediaurls, 1) > 0 
        AND p.mediaurls[1] IS NOT NULL
      ORDER BY p.createdat DESC
      LIMIT $1 OFFSET $2
    `;
    const postsResult = await client.query(postsQuery, [options.limit, options.offset]);
    return postsResult.rows;
  } finally {
    client.release();
  }
}

export async function addPostDb(newPost: DbNewPost): Promise<Post> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot add post.");

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const postQuery = `
      INSERT INTO posts(content, latitude, longitude, mediaurls, mediatype, hashtags, city, authorid, is_family_post, hide_location)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const postValues = [newPost.content, newPost.latitude, newPost.longitude, newPost.mediaurls, newPost.mediatype, newPost.hashtags, newPost.city, newPost.authorid, newPost.is_family_post, newPost.hide_location];
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
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'DELETE FROM posts WHERE id = $1';
    await client.query(query, [postId]);
  } finally {
    client.release();
  }
}


export async function updatePostLikeCountDb(postId: number, direction: 'increment' | 'decrement'): Promise<Post | null> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot update like count.");
  const client = await dbPool.connect();
  try {
    const operator = direction === 'increment' ? '+' : '-';
    const query = `
      UPDATE posts
      SET likecount = likecount ${operator} 1
      WHERE id = $1 AND likecount >= 0
      RETURNING *;
    `;
    const result: QueryResult<Post> = await client.query(query, [postId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function addCommentDb(commentData: NewComment): Promise<Comment> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured. Cannot add comment.");
  
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const commentQuery = `
      INSERT INTO comments(postid, author, content)
      VALUES($1, $2, $3)
      RETURNING *;
    `;
    const values = [commentData.postId, commentData.author, commentData.content];
    const result: QueryResult<Comment> = await client.query(commentQuery, values);
    
    await client.query('UPDATE posts SET commentcount = commentcount + 1 WHERE id = $1', [commentData.postId]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getCommentsByPostIdDb(postId: number): Promise<Comment[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT * FROM comments
      WHERE postid = $1
      ORDER BY createdat DESC;
    `;
    const result: QueryResult<Comment> = await client.query(query, [postId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function incrementAndGetVisitorCountsDb(): Promise<VisitorCounts> {
  await ensureDbInitialized();
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
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return { totalVisits: 0, dailyVisits: 0 };
  
  const client = await dbPool.connect();
  try {
    const totalVisitsRes = await client.query("SELECT value FROM visitor_stats WHERE stat_key = 'total_visits'");
    const dailyVisitsRes = await client.query("SELECT value FROM visitor_stats WHERE stat_key = 'daily_visits_count'");
    
    const dateRes = await client.query("SELECT value FROM visitor_stats WHERE stat_key = 'daily_visits_date'");
    const today = new Date().setHours(0, 0, 0, 0);
    let dailyVisits = dailyVisitsRes.rows[0]?.value || 0;

    if (dateRes.rows[0]?.value !== today) {
      await client.query("UPDATE visitor_stats SET value = 0 WHERE stat_key = 'daily_visits_count'");
      dailyVisits = 0;
    }

    return {
      totalVisits: totalVisitsRes.rows[0]?.value || 0,
      dailyVisits: dailyVisits,
    };
  } finally {
    client.release();
  }
}

export async function addOrUpdateDeviceTokenDb(token: string, latitude?: number, longitude?: number, userId?: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return;

  const client = await dbPool.connect();
  try {
      const query = `
      INSERT INTO device_tokens (token, latitude, longitude, user_id, last_updated)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (token) DO UPDATE 
        SET latitude = EXCLUDED.latitude, 
            longitude = EXCLUDED.longitude,
            user_id = EXCLUDED.user_id,
            last_updated = NOW();
    `;
    await client.query(query, [token, latitude, longitude, userId]);

    // Also update the user's last known location if they are a business
    if (userId && latitude && longitude) {
        await client.query(`UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3`, [latitude, longitude, userId]);
    }
  } finally {
    client.release();
  }
}

export async function updateUserLocationDb(userId: number, latitude: number, longitude: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return;
  const client = await dbPool.connect();
  try {
    // This query updates all tokens for a user. If they have none, it does nothing.
    const query = `
      UPDATE device_tokens 
      SET latitude = $1, longitude = $2, last_updated = NOW()
      WHERE user_id = $3;
    `;
    await client.query(query, [latitude, longitude, userId]);
     if (latitude && longitude) {
        await client.query(`UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3`, [latitude, longitude, userId]);
    }
  } finally {
    client.release();
  }
}

export async function getNearbyDeviceTokensDb(latitude: number, longitude: number, radiusKm: number = 20): Promise<string[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT token FROM device_tokens
      WHERE earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth(latitude, longitude)
      AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) < $3 * 1000;
    `;
    const result: QueryResult<{token: string}> = await client.query(query, [latitude, longitude, radiusKm]);
    return result.rows.map(row => row.token);
  } finally {
    client.release();
  }
}

export async function deleteDeviceTokenDb(token: string): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return;
  const client = await dbPool.connect();
  try {
    await client.query('DELETE FROM device_tokens WHERE token = $1', [token]);
  } finally {
    client.release();
  }
}

export async function getDeviceTokensForUsersDb(userIds: number[]): Promise<string[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool || userIds.length === 0) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT token FROM device_tokens
      WHERE user_id = ANY($1::int[]) AND token IS NOT NULL;
    `;
    const result: QueryResult<{token: string}> = await client.query(query, [userIds]);
    return result.rows.map(row => row.token);
  } finally {
    client.release();
  }
}


export async function getNewerPostsCountDb(latestIdKnown: number): Promise<number> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return 0;

  const client = await dbPool.connect();
  try {
    const query = 'SELECT COUNT(*) FROM posts WHERE id > $1';
    const result = await client.query(query, [latestIdKnown]);
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

export async function getPostByIdDb(postId: number, userRole?: UserRole): Promise<Post | null> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return null;

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT ${POST_COLUMNS_SANITIZED}
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.id = $1;
    `;
    const result: QueryResult<Post> = await client.query(query, [postId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL pool has ended');
    pool = null;
  }
}

export async function incrementPostViewCountDb(postId: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return;
    const client = await dbPool.connect();
    try {
      await client.query('UPDATE posts SET viewcount = viewcount + 1 WHERE id = $1', [postId]);
    } finally {
      client.release();
    }
}

export async function updateNotifiedCountDb(postId: number, count: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return;
    const client = await dbPool.connect();
    try {
      await client.query('UPDATE posts SET notifiedcount = $1 WHERE id = $2', [count, postId]);
    } finally {
      client.release();
    }
}

// --- User & Like Functions ---

export async function checkIfUserLikedPostDb(userId: number, postId: number): Promise<boolean> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return false;
  const client = await dbPool.connect();
  try {
    const query = 'SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2';
    const result = await client.query(query, [userId, postId]);
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function addLikeDb(userId: number, postId: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await client.query(query, [userId, postId]);
  } finally {
    client.release();
  }
}

export async function removeLikeDb(userId: number, postId: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2';
    await client.query(query, [userId, postId]);
  } finally {
    client.release();
  }
}

export async function getLikedPostIdsForUserDb(userId: number, postIds: number[]): Promise<Set<number>> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool || postIds.length === 0) return new Set();

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::int[])
    `;
    const result = await client.query(query, [userId, postIds]);
    return new Set(result.rows.map(r => r.post_id));
  } finally {
    client.release();
  }
}

export async function createUserDb(newUser: NewUser, status: 'pending' | 'approved' = 'pending'): Promise<User> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured. Cannot create user.");
    
    const client = await dbPool.connect();
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordhash = await bcrypt.hash(newUser.passwordplaintext, salt);
      
      const query = `
          INSERT INTO users(name, email, passwordhash, role, status, mobilenumber, business_category, business_other_category)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING ${USER_COLUMNS_SANITIZED};
      `;
      const values = [newUser.name, newUser.email.toLowerCase(), passwordhash, newUser.role, status, newUser.mobilenumber, newUser.business_category, newUser.business_other_category];
      const result: QueryResult<User> = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
}

export async function getUserByEmailDb(email: string): Promise<UserWithPassword | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;
    
    const client = await dbPool.connect();
    try {
      const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
      const result: QueryResult<UserWithPassword> = await client.query(query, [email]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}

export async function getUserByIdDb(id: number): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const client = await dbPool.connect();
    try {
      const query = `
        SELECT ${USER_COLUMNS_SANITIZED}
        FROM users 
        WHERE id = $1
      `;
      const result: QueryResult<User> = await client.query(query, [id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}

export async function updateUserNameDb(userId: number, name: string): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");
    
    const client = await dbPool.connect();
    try {
      const query = `
        UPDATE users
        SET name = $1
        WHERE id = $2
        RETURNING ${USER_COLUMNS_SANITIZED};
      `;
      const result: QueryResult<User> = await client.query(query, [name, userId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}

export async function updateUserProfilePictureDb(userId: number, imageUrl: string): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'UPDATE users SET profilepictureurl = $1 WHERE id = $2';
    await client.query(query, [imageUrl, userId]);
  } finally {
    client.release();
  }
}


export async function getPostsByUserIdDb(userId: number): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT ${POST_COLUMNS_SANITIZED}
      FROM posts p
      JOIN users u ON p.authorid = u.id
      WHERE p.authorid = $1
      ORDER BY p.createdat DESC;
    `;
    const result: QueryResult<Post> = await client.query(query, [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getPendingUsersDb(): Promise<User[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
      const query = `
          SELECT ${USER_COLUMNS_SANITIZED}
          FROM users 
          WHERE status = 'pending'
          ORDER BY createdat ASC;
      `;
      const result: QueryResult<User> = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
}

export async function getAllUsersDb(): Promise<User[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
      const query = `
          SELECT ${USER_COLUMNS_SANITIZED}
          FROM users 
          ORDER BY createdat DESC;
      `;
      const result: QueryResult<User> = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
}

export async function updateUserStatusDb(userId: number, status: 'approved' | 'rejected'): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured. Cannot update user status.");

    const client = await dbPool.connect();
    try {
      const query = `
          UPDATE users
          SET status = $1
          WHERE id = $2
          RETURNING ${USER_COLUMNS_SANITIZED};
      `;
      const result: QueryResult<User> = await client.query(query, [status, userId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}

export async function updateUserDb(userId: number, userData: UpdatableUserFields): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
      const query = `
        UPDATE users
        SET name = $1, email = $2, role = $3, status = $4
        WHERE id = $5
        RETURNING ${USER_COLUMNS_SANITIZED};
      `;
      const values = [userData.name, userData.email.toLowerCase(), userData.role, userData.status, userId];
      const result: QueryResult<User> = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}

export async function deleteUserDb(userId: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'DELETE FROM users WHERE id = $1';
    await client.query(query, [userId]);
  } finally {
    client.release();
  }
}

// --- Follower Functions ---

export async function followUserDb(followerId: number, followingId: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'INSERT INTO user_followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await client.query(query, [followerId, followingId]);
  } finally {
    client.release();
  }
}

export async function unfollowUserDb(followerId: number, followingId: number): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const query = 'DELETE FROM user_followers WHERE follower_id = $1 AND following_id = $2';
    await client.query(query, [followerId, followingId]);
  } finally {
    client.release();
  }
}

export async function getFollowerCountsDb(userId: number): Promise<UserFollowStats> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return { followerCount: 0, followingCount: 0 };
  
  const client = await dbPool.connect();
  try {
    const followerQuery = 'SELECT COUNT(*) FROM user_followers WHERE following_id = $1';
    const followingQuery = 'SELECT COUNT(*) FROM user_followers WHERE follower_id = $1';

    const [followerResult, followingResult] = await Promise.all([
      client.query(followerQuery, [userId]),
      client.query(followingQuery, [userId]),
    ]);

    return {
      followerCount: parseInt(followerResult.rows[0].count, 10),
      followingCount: parseInt(followingResult.rows[0].count, 10),
    };
  } finally {
    client.release();
  }
}

export async function checkIfUserIsFollowingDb(followerId: number, followingId: number): Promise<boolean> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return false;
  const client = await dbPool.connect();
  try {
    const query = 'SELECT 1 FROM user_followers WHERE follower_id = $1 AND following_id = $2';
    const result = await client.query(query, [followerId, followingId]);
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function getFollowingListDb(userId: number): Promise<FollowUser[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT u.id, u.name, u.profilepictureurl
      FROM user_followers f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1 AND u.status = 'approved'
      ORDER BY u.name ASC;
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getFollowedUserIdsDb(currentUserId: number, authorIds: number[]): Promise<Set<number>> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool || authorIds.length === 0) return new Set();

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT following_id FROM user_followers 
      WHERE follower_id = $1 AND following_id = ANY($2::int[]);
    `;
    const result = await client.query(query, [currentUserId, authorIds]);
    return new Set(result.rows.map(r => r.following_id));
  } finally {
    client.release();
  }
}


// --- Mention Functions ---

export async function searchUsersDb(query: string, currentUserId?: number): Promise<User[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];
  
  const client = await dbPool.connect();
  try {
    const sqlQuery = `
      SELECT ${USER_COLUMNS_SANITIZED}
      FROM users 
      WHERE name ILIKE $1 
        AND status = 'approved'
        AND ($2::int IS NULL OR id != $2::int)
      LIMIT 10;
    `;
    const result: QueryResult<User> = await client.query(sqlQuery, [`%${query}%`, currentUserId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getMentionsForPostsDb(postIds: number[]): Promise<Map<number, { id: number; name: string }[]>> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool || postIds.length === 0) return new Map();

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT pm.post_id, u.id, u.name
      FROM post_mentions pm
      JOIN users u ON pm.mentioned_user_id = u.id
      WHERE pm.post_id = ANY($1::int[]);
    `;
    const result = await client.query(query, [postIds]);

    const mentionsMap = new Map<number, { id: number; name: string }[]>();
    for (const row of result.rows) {
      const { post_id, id, name } = row;
      if (!mentionsMap.has(post_id)) {
        mentionsMap.set(post_id, []);
      }
      mentionsMap.get(post_id)!.push({ id, name });
    }
    return mentionsMap;
  } finally {
    client.release();
  }
}

// --- Status (Story) Functions ---

export async function addStatusDb(newStatus: NewStatus): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");

  const client = await dbPool.connect();
  try {
    const query = 'INSERT INTO statuses (user_id, media_url, media_type) VALUES ($1, $2, $3)';
    await client.query(query, [newStatus.userId, newStatus.mediaUrl, newStatus.mediaType]);
  } finally {
    client.release();
  }
}

export async function getStatusesForFeedDb(userId: number): Promise<UserWithStatuses[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const followingQuery = 'SELECT following_id FROM user_followers WHERE follower_id = $1';
    const followingResult = await client.query(followingQuery, [userId]);
    const followingIds = followingResult.rows.map(r => r.following_id);
    
    const userIdsToFetch = [userId, ...followingIds];
    if (userIdsToFetch.length === 0) return [];

    const query = `
      SELECT 
        s.id,
        s.media_url,
        s.media_type,
        s.created_at,
        u.id as user_id,
        u.name as user_name,
        u.profilepictureurl as user_profile_picture_url
      FROM statuses s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ANY($1::int[])
      AND s.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY u.id, s.created_at ASC;
    `;

    const result: QueryResult<Status & { user_id: number; user_name: string; user_profile_picture_url: string | null }> = await client.query(query, [userIdsToFetch]);
    
    const usersWithStatuses = new Map<number, UserWithStatuses>();
    
    for (const row of result.rows) {
      if (!usersWithStatuses.has(row.user_id)) {
        usersWithStatuses.set(row.user_id, {
          userId: row.user_id,
          userName: row.user_name,
          userProfilePictureUrl: row.user_profile_picture_url,
          statuses: [],
        });
      }
      usersWithStatuses.get(row.user_id)!.statuses.push({
        id: row.id,
        media_url: row.media_url,
        media_type: row.media_type,
        created_at: row.created_at,
      });
    }
    
    const finalResult = Array.from(usersWithStatuses.values());
    
    finalResult.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      const aLatest = new Date(a.statuses[a.statuses.length - 1].created_at).getTime();
      const bLatest = new Date(b.statuses[b.statuses.length - 1].created_at).getTime();
      return bLatest - aLatest;
    });
    
    return finalResult;
  } finally {
    client.release();
  }
}


// --- Chat Functions ---

export async function findOrCreateConversationDb(user1Id: number, user2Id: number): Promise<number> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        const findQuery = `
            SELECT cp1.conversation_id
            FROM conversation_participants AS cp1
            JOIN conversation_participants AS cp2 ON cp1.conversation_id = cp2.conversation_id
            WHERE cp1.user_id = $1 AND cp2.user_id = $2
            LIMIT 1;
        `;
        const findResult = await client.query(findQuery, [user1Id, user2Id]);

        if (findResult.rows.length > 0) {
            await client.query('COMMIT');
            return findResult.rows[0].conversation_id;
        }

        const createConvQuery = 'INSERT INTO conversations DEFAULT VALUES RETURNING id;';
        const convResult = await client.query(createConvQuery);
        const conversationId = convResult.rows[0].id;

        const addParticipantsQuery = `
            INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3);
        `;
        await client.query(addParticipantsQuery, [conversationId, user1Id, user2Id]);

        await client.query('COMMIT');
        return conversationId;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in findOrCreateConversationDb transaction:", error);
        throw error;
    } finally {
       client.release();
    }
}

export async function addMessageDb(newMessage: NewMessage): Promise<Message> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");
    
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        const messageQuery = `
            INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *;
        `;
        const messageResult: QueryResult<Message> = await client.query(messageQuery, [newMessage.conversationId, newMessage.senderId, newMessage.content]);
        
        const updateConvQuery = `
            UPDATE conversations SET last_message_at = NOW() WHERE id = $1;
        `;
        await client.query(updateConvQuery, [newMessage.conversationId]);

        const updateUnreadQuery = `
            UPDATE conversation_participants
            SET unread_count = unread_count + 1
            WHERE conversation_id = $1 AND user_id != $2;
        `;
        await client.query(updateUnreadQuery, [newMessage.conversationId, newMessage.senderId]);

        await client.query('COMMIT');
        return messageResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in addMessageDb:", error);
        throw error;
    } finally {
        client.release();
    }
}

export async function getMessagesForConversationDb(conversationId: number, userId: number): Promise<Message[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
      const checkQuery = 'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2';
      const checkResult = await client.query(checkQuery, [conversationId, userId]);
      if (checkResult.rowCount === 0) {
          throw new Error("Access denied. User is not a participant in this conversation.");
      }
      
      const messagesQuery = `
          SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC;
      `;
      const messagesResult: QueryResult<Message> = await client.query(messagesQuery, [conversationId]);
      return messagesResult.rows;
    } finally {
      client.release();
    }
}

export async function getConversationsForUserDb(userId: number): Promise<Conversation[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT
          c.id,
          c.created_at,
          c.last_message_at,
          p_other.user_id AS participant_id,
          u_other.name AS participant_name,
          u_other.profilepictureurl AS participant_profile_picture_url,
          lm.content AS last_message_content,
          lm.sender_id AS last_message_sender_id,
          p_me.unread_count
      FROM
          conversation_participants AS p_me
      JOIN
          conversation_participants AS p_other ON p_me.conversation_id = p_other.conversation_id AND p_me.user_id != p_other.user_id
      JOIN
          conversations AS c ON p_me.conversation_id = c.id
      JOIN
          users AS u_other ON p_other.user_id = u_other.id
      LEFT JOIN LATERAL (
          SELECT content, sender_id FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
      ) lm ON true
      WHERE
          p_me.user_id = $1
      ORDER BY
          c.last_message_at DESC;
    `;
    
    const result: QueryResult<Conversation> = await client.query(query, [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}


export async function getConversationPartnerDb(conversationId: number, currentUserId: number): Promise<ConversationParticipant | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const client = await dbPool.connect();
    try {
      const query = `
          SELECT u.id, u.name, u.profilepictureurl FROM users u
          JOIN conversation_participants cp ON u.id = cp.user_id
          WHERE cp.conversation_id = $1 AND cp.user_id != $2;
      `;
      const result = await client.query(query, [conversationId, currentUserId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
}


export async function markConversationAsReadDb(conversationId: number, userId: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return;

    const client = await dbPool.connect();
    try {
      const query = `
          UPDATE conversation_participants
          SET unread_count = 0
          WHERE conversation_id = $1 AND user_id = $2;
      `;
      await client.query(query, [conversationId, userId]);
    } finally {
      client.release();
    }
}

export async function getTotalUnreadMessagesDb(userId: number): Promise<number> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return 0;
    
    const client = await dbPool.connect();
    try {
      const query = `
          SELECT SUM(unread_count) as total_unread
          FROM conversation_participants
          WHERE user_id = $1;
      `;
      const result = await client.query(query, [userId]);
      return parseInt(result.rows[0]?.total_unread, 10) || 0;
    } finally {
      client.release();
    }
}

export async function updateUserMobileDb(userId: number, mobileNumber: string): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        const query = `
            UPDATE users
            SET mobilenumber = $1
            WHERE id = $2
            RETURNING ${USER_COLUMNS_SANITIZED};
        `;
        const result = await client.query(query, [mobileNumber, userId]);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
}

export async function updateUserBusinessCategoryDb(userId: number, data: UpdateBusinessCategory): Promise<User | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        const query = `
            UPDATE users
            SET business_category = $1, business_other_category = $2
            WHERE id = $3
            RETURNING ${USER_COLUMNS_SANITIZED};
        `;
        const result = await client.query(query, [data.business_category, data.business_other_category, userId]);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
}

// --- Family Relationship Functions ---

export async function getFamilyRelationshipDb(userId1: number, userId2: number): Promise<FamilyRelationship | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const client = await dbPool.connect();
    try {
        const [u1, u2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
        const query = `SELECT * FROM family_relationships WHERE user_id_1 = $1 AND user_id_2 = $2`;
        const result = await client.query(query, [u1, u2]);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
}

export async function sendFamilyRequestDb(requesterId: number, receiverId: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        const [u1, u2] = requesterId < receiverId ? [requesterId, receiverId] : [receiverId, requesterId];
        const query = `
            INSERT INTO family_relationships (user_id_1, user_id_2, requester_id, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT (user_id_1, user_id_2) DO UPDATE
            SET requester_id = $3, status = 'pending', created_at = NOW()
            WHERE family_relationships.status = 'rejected';
        `;
        await client.query(query, [u1, u2, requesterId]);
    } finally {
        client.release();
    }
}

export async function updateFamilyRequestStatusDb(relationshipId: number, status: 'approved' | 'rejected'): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        const query = `UPDATE family_relationships SET status = $1 WHERE id = $2`;
        await client.query(query, [status, relationshipId]);
    } finally {
        client.release();
    }
}

export async function deleteFamilyRelationshipDb(relationshipId: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        await client.query('DELETE FROM family_relationships WHERE id = $1', [relationshipId]);
    } finally {
        client.release();
    }
}

export async function getPendingFamilyRequestsForUserDb(userId: number): Promise<PendingFamilyRequest[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT fr.id, fr.requester_id, u.name as requester_name, u.profilepictureurl as requester_profile_picture_url
            FROM family_relationships fr
            JOIN users u ON fr.requester_id = u.id
            WHERE (fr.user_id_1 = $1 OR fr.user_id_2 = $1)
            AND fr.status = 'pending'
            AND fr.requester_id != $1;
        `;
        const result = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function getFamilyMembersForUserDb(userId: number): Promise<FamilyMember[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT
                u.id, u.name, u.role, u.status, u.createdat, u.profilepictureurl, u.mobilenumber, u.business_category, u.business_other_category,
                CASE
                    WHEN fr.user_id_1 = $1 THEN fr.share_location_from_1_to_2
                    ELSE fr.share_location_from_2_to_1
                END AS i_am_sharing_with_them,
                CASE
                    WHEN fr.user_id_1 = $1 THEN fr.share_location_from_2_to_1
                    ELSE fr.share_location_from_1_to_2
                END AS they_are_sharing_with_me,
                latest_token.latitude,
                latest_token.longitude,
                latest_token.last_updated
            FROM family_relationships fr
            JOIN users u ON u.id = (
                CASE
                    WHEN fr.user_id_1 = $1 THEN fr.user_id_2
                    ELSE fr.user_id_1
                END
            )
            LEFT JOIN LATERAL (
                SELECT latitude, longitude, last_updated
                FROM device_tokens
                WHERE user_id = u.id AND latitude IS NOT NULL AND longitude IS NOT NULL
                ORDER BY last_updated DESC
                LIMIT 1
            ) latest_token ON true
            WHERE (fr.user_id_1 = $1 OR fr.user_id_2 = $1) AND fr.status = 'approved';
        `;
        const result = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}


export async function toggleLocationSharingDb(currentUserId: number, targetUserId: number, share: boolean): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        const [u1, u2] = currentUserId < targetUserId ? [currentUserId, targetUserId] : [targetUserId, currentUserId];
        
        let columnToUpdate;
        if (currentUserId < targetUserId) {
            columnToUpdate = 'share_location_from_1_to_2';
        } else {
            columnToUpdate = 'share_location_from_2_to_1';
        }

        const query = `
            UPDATE family_relationships
            SET ${columnToUpdate} = $1
            WHERE user_id_1 = $2 AND user_id_2 = $3 AND status = 'approved'
        `;

        await client.query(query, [share, u1, u2]);
    } finally {
        client.release();
    }
}

export async function getFamilyLocationsForUserDb(userId: number): Promise<FamilyMemberLocation[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT
                u.id,
                u.name,
                u.profilepictureurl,
                latest_token.latitude,
                latest_token.longitude,
                latest_token.last_updated
            FROM family_relationships fr
            JOIN users u ON u.id = (
                CASE
                    WHEN fr.user_id_1 = $1 THEN fr.user_id_2
                    ELSE fr.user_id_1
                END
            )
            -- This join finds the most recent location for the family member
            JOIN LATERAL (
                SELECT latitude, longitude, last_updated
                FROM device_tokens
                WHERE user_id = u.id AND latitude IS NOT NULL AND longitude IS NOT NULL
                ORDER BY last_updated DESC
                LIMIT 1
            ) latest_token ON true
            -- This condition checks if the family member is sharing their location with the current user
            WHERE (
                (fr.user_id_1 = $1 AND fr.share_location_from_2_to_1 = TRUE)
                OR (fr.user_id_2 = $1 AND fr.share_location_from_1_to_2 = TRUE)
            ) AND fr.status = 'approved';
        `;
        const result: QueryResult<FamilyMemberLocation> = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function getRecipientsForSosDb(senderId: number): Promise<{ id: number }[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT user_id_2 AS recipient_id
            FROM family_relationships
            WHERE user_id_1 = $1 AND status = 'approved' AND share_location_from_1_to_2 = TRUE
            UNION
            SELECT user_id_1 AS recipient_id
            FROM family_relationships
            WHERE user_id_2 = $1 AND status = 'approved' AND share_location_from_2_to_1 = TRUE;
        `;
        const result = await client.query(query, [senderId]);
        return result.rows.map(row => ({ id: row.recipient_id }));
    } finally {
        client.release();
    }
}

// --- Business Functions ---

export async function getNearbyBusinessesDb(options: {
  limit: number;
  offset: number;
  latitude: number;
  longitude: number;
  category?: string;
}): Promise<BusinessUser[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const { limit, offset, latitude, longitude, category } = options;
    const queryParams: any[] = [latitude, longitude, 20000, limit, offset]; // 20km radius

    let categoryFilter = '';
    if (category) {
        queryParams.push(category);
        categoryFilter = `AND business_category = $${queryParams.length}`;
    }

    const distanceCalc = `earth_distance(ll_to_earth(latitude, longitude), ll_to_earth($1, $2))`;

    const query = `
        SELECT ${USER_COLUMNS_SANITIZED}, ${distanceCalc} as distance
        FROM users
        WHERE role = 'Business'
          AND status = 'approved'
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND ${distanceCalc} <= $3
          ${categoryFilter}
        ORDER BY distance ASC
        LIMIT $4 OFFSET $5;
    `;

    const result = await client.query(query, queryParams);
    return result.rows;
  } finally {
    client.release();
  }
}
