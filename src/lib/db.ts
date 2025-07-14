

import { Pool, Client, type QueryResult } from 'pg';
import type { ConversationDetails, PointTransaction, UserForNotification, PointTransactionReason, User as DbUser, Post, DbNewPost, Comment, NewComment, VisitorCounts, DeviceToken, User, UserWithPassword, NewUser, UserRole, UpdatableUserFields, UserFollowStats, FollowUser, NewStatus, UserWithStatuses, Conversation, Message, NewMessage, ConversationParticipant, FamilyRelationship, PendingFamilyRequest, FamilyMember, FamilyMemberLocation, SortOption, UpdateBusinessCategory, BusinessUser, GorakshakReportUser, UserStatus, Poll } from '@/lib/db-types';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';

// Re-export db-types
export * from './db-types';

let pool: Pool | null = null;
let dbWarningShown = false;
let initializationPromise: Promise<void> | null = null;

const OFFICIAL_USER_EMAIL = 'official@localpulse.in';


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
            role VARCHAR(50) NOT NULL CHECK (role IN ('Business', 'Gorakshak', 'Gorakshak Admin', 'Admin', 'Public(जनता)')),
            status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'verified', 'pending_verification')),
            createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            profilepictureurl TEXT,
            mobilenumber VARCHAR(20),
            business_category TEXT,
            business_other_category TEXT,
            latitude REAL,
            longitude REAL,
            lp_points INTEGER DEFAULT 0 NOT NULL,
            referral_code VARCHAR(10) UNIQUE,
            referred_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        `);
        
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobilenumber VARCHAR(20);`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_category TEXT;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_other_category TEXT;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude REAL;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude REAL;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_points INTEGER DEFAULT 0 NOT NULL;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
        await initClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`);
        
        // Add a check constraint to the user status
        await initClient.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;`);
        await initClient.query(`ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'verified', 'pending_verification'));`);

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
            hide_location BOOLEAN DEFAULT false NOT NULL,
            lp_bonus_awarded BOOLEAN DEFAULT false NOT NULL,
            expires_at TIMESTAMPTZ,
            max_viewers INTEGER
        );
        `);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_family_post BOOLEAN DEFAULT false NOT NULL;`);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_location BOOLEAN DEFAULT false NOT NULL;`);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS lp_bonus_awarded BOOLEAN DEFAULT false NOT NULL;`);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`);
         await initClient.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS max_viewers INTEGER;`);
        
        // Poll Tables
        await initClient.query(`
            CREATE TABLE IF NOT EXISTS polls (
                id SERIAL PRIMARY KEY,
                post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                question TEXT NOT NULL
            );
        `);
        await initClient.query(`
            CREATE TABLE IF NOT EXISTS poll_options (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                option_text TEXT NOT NULL,
                vote_count INTEGER DEFAULT 0 NOT NULL
            );
        `);
        await initClient.query(`
            CREATE TABLE IF NOT EXISTS poll_votes (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, poll_id)
            );
        `);

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
        await initClient.query(`CREATE TABLE IF NOT EXISTS device_tokens ( id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, latitude REAL, longitude REAL, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, user_auth_token TEXT );`);
        await initClient.query(`ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS user_auth_token TEXT;`);
        // Visitor Stats Table
        await initClient.query(`CREATE TABLE IF NOT EXISTS visitor_stats ( stat_key VARCHAR(255) PRIMARY KEY, value BIGINT NOT NULL );`);
        await initClient.query(`INSERT INTO visitor_stats (stat_key, value) VALUES ('total_visits', 0), ('daily_visits_date', 0), ('daily_visits_count', 0) ON CONFLICT (stat_key) DO NOTHING;`);
        
        // Chat Tables
        await initClient.query(`
            CREATE TABLE IF NOT EXISTS conversations ( 
                id SERIAL PRIMARY KEY, 
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
                last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                is_group BOOLEAN DEFAULT false NOT NULL,
                group_name VARCHAR(255),
                group_avatar_url TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );
        `);
        // Add group columns if they don't exist
        await initClient.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false NOT NULL;`);
        await initClient.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);`);
        await initClient.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_avatar_url TEXT;`);
        await initClient.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);

        await initClient.query(`
            CREATE TABLE IF NOT EXISTS conversation_participants ( 
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, 
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                unread_count INTEGER NOT NULL DEFAULT 0,
                is_admin BOOLEAN DEFAULT false NOT NULL,
                PRIMARY KEY (conversation_id, user_id) 
            );
        `);
        await initClient.query(`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;`);

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
        // LP Points Transactions Table
        await initClient.query(`
            CREATE TABLE IF NOT EXISTS lp_point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                points INTEGER NOT NULL,
                reason VARCHAR(50) NOT NULL,
                description TEXT,
                related_entity_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);


        // --- Create or Update Official User ---
        const officialUserPassword = process.env.OFFICIAL_USER_PASSWORD;
        let passwordHash;
        if (officialUserPassword) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(officialUserPassword, salt);
        } else {
            // This makes the account impossible to log into if the password is not set
            passwordHash = 'not_a_real_password_so_login_is_impossible_' + Math.random();
        }

        await initClient.query(`
            INSERT INTO users (name, email, passwordhash, role, status, lp_points, referral_code)
            VALUES ('LocalPulse Official', $1, $2, 'Admin', 'approved', 0, 'LOCALPULSE')
            ON CONFLICT (email) DO UPDATE
            SET passwordhash = $2;
        `, [OFFICIAL_USER_EMAIL, passwordHash]);
        
        // --- Retroactively award points to existing users ---
        await initClient.query(`
            UPDATE users SET lp_points = 20 WHERE lp_points = 0 AND referred_by_id IS NULL AND email != $1;
        `, [OFFICIAL_USER_EMAIL]);


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
        await initClient.query('CREATE INDEX IF NOT EXISTS users_gorakshak_geo_idx ON users USING gist (ll_to_earth(latitude, longitude)) WHERE role = \'Gorakshak\' OR role = \'Gorakshak Admin\'');
        await initClient.query('CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique_idx ON users (referral_code) WHERE referral_code IS NOT NULL;');
        await initClient.query('CREATE INDEX IF NOT EXISTS lp_point_transactions_user_id ON lp_point_transactions(user_id);');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active DESC);');
        await initClient.query('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);');


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

const POST_COLUMNS_WITH_JOINS = `
  p.id, p.content, p.latitude, p.longitude, p.createdat, p.likecount, 
  p.commentcount, p.viewcount, p.notifiedcount, p.city, p.hashtags, 
  p.is_family_post, p.hide_location, p.authorid, p.mediatype, p.mediaurls,
  p.expires_at, p.max_viewers,
  u.name as authorname, u.role as authorrole,
  u.profilepictureurl as authorprofilepictureurl
`;

const USER_COLUMNS_SANITIZED = `
  id, email, name, role, status, createdat, profilepictureurl, mobilenumber, 
  business_category, business_other_category, latitude, longitude,
  lp_points, referral_code
`;

export async function getPostsDb(
  options: { 
    limit: number; 
    offset: number;
    latitude?: number | null;
    longitude?: number | null;
    sortBy?: SortOption;
    currentUserId?: number | null;
  } = { limit: 10, offset: 0, sortBy: 'newest' },
  isAdminView: boolean = false
): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    let orderByClause: string;
    const queryParams: (string | number | null)[] = [];
    let paramIndex = 1;

    // Explicitly cast the user ID parameter to handle nulls gracefully.
    const currentUserIdParam = options.currentUserId || null;
    queryParams.push(currentUserIdParam);
    const userIdParamIndex = paramIndex++;

    const likeCheck = `EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $${userIdParamIndex}::int)`;
    const followCheck = `p.authorid IS NOT NULL AND EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.authorid AND uf.follower_id = $${userIdParamIndex}::int)`;

    const sortBy = options.sortBy || 'newest';

    switch(sortBy) {
      case 'likes':
        orderByClause = 'p.likecount DESC, p.createdat DESC';
        break;
      case 'comments':
        orderByClause = 'p.commentcount DESC, p.createdat DESC';
        break;
      case 'newest':
      default:
        let distanceCalc = '';
        if (options.latitude != null && options.longitude != null && !isAdminView) {
            queryParams.push(options.latitude, options.longitude);
            distanceCalc = `earth_distance(ll_to_earth(p.latitude, p.longitude), ll_to_earth($${paramIndex++}, $${paramIndex++}))`;
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
             orderByClause = 'p.createdat DESC';
        }
        break;
    }
    
    let allPosts: Post[] = [];

    // Step 1: Fetch the latest announcement if it's the first page
    if (options.offset === 0 && !isAdminView) {
        const announcementQuery = `
          SELECT 
            ${POST_COLUMNS_WITH_JOINS},
            ${likeCheck} as "isLikedByCurrentUser",
            ${followCheck} as "isAuthorFollowedByCurrentUser"
          FROM posts p
          LEFT JOIN users u ON p.authorid = u.id
          WHERE u.email = $2 -- Find user by special email
          ORDER BY p.createdat DESC
          LIMIT 1
        `;
        const announcementResult = await client.query(announcementQuery, [currentUserIdParam, OFFICIAL_USER_EMAIL]);
        if (announcementResult.rows.length > 0) {
            allPosts = announcementResult.rows;
        }
    }

    const officialUserSubquery = `SELECT id FROM users WHERE email = '${OFFICIAL_USER_EMAIL}'`;

    queryParams.push(options.limit, options.offset);
    const limitParamIndex = paramIndex++;
    const offsetParamIndex = paramIndex++;

    const postsQuery = `
      SELECT 
        ${POST_COLUMNS_WITH_JOINS},
        ${likeCheck} as "isLikedByCurrentUser",
        ${followCheck} as "isAuthorFollowedByCurrentUser"
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.is_family_post = false 
        AND (p.authorid IS NULL OR p.authorid != (${officialUserSubquery}))
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (p.max_viewers IS NULL OR p.viewcount < p.max_viewers)
      ORDER BY ${orderByClause}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const postsResult = await client.query(postsQuery, queryParams);
    
    const announcementId = allPosts.length > 0 ? allPosts[0].id : null;
    const regularPosts = postsResult.rows.filter(p => p.id !== announcementId);

    const combined = [...allPosts, ...regularPosts];
    
    return combined.slice(0, options.limit);
    
  } finally {
    client.release();
  }
}

export async function getPostsInBoundsDb(bounds: { ne: { lat: number, lng: number }, sw: { lat: number, lng: number } }): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const { ne, sw } = bounds;
    // The bounding box is defined by two points: (sw.lat, sw.lng) and (ne.lat, ne.lng)
    const query = `
      SELECT ${POST_COLUMNS_WITH_JOINS}
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.latitude < $1 AND p.latitude > $2
        AND p.longitude < $3 AND p.longitude > $4
        AND p.is_family_post = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (p.max_viewers IS NULL OR p.viewcount < p.max_viewers)
      ORDER BY p.createdat DESC
      LIMIT 200;
    `;
    const result = await client.query(query, [ne.lat, sw.lat, ne.lng, sw.lng]);
    return result.rows;
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
            SELECT ${POST_COLUMNS_WITH_JOINS},
              EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1::int) as "isLikedByCurrentUser",
              EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.authorid AND uf.follower_id = $1::int) as "isAuthorFollowedByCurrentUser"
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


export async function getMediaPostsDb(options: { limit: number; offset: number; currentUserId?: number | null; } = { limit: 10, offset: 0 }): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const userIdParam = options.currentUserId || null;
    const likeCheck = `EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1::int)`;
    const followCheck = `p.authorid IS NOT NULL AND EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.authorid AND uf.follower_id = $1::int)`;

    const postsQuery = `
      SELECT 
        ${POST_COLUMNS_WITH_JOINS},
        ${likeCheck} as "isLikedByCurrentUser",
        ${followCheck} as "isAuthorFollowedByCurrentUser"
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE 
        p.is_family_post = false
        AND p.mediaurls IS NOT NULL 
        AND array_length(p.mediaurls, 1) > 0 
        AND p.mediaurls[1] IS NOT NULL
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (p.max_viewers IS NULL OR p.viewcount < p.max_viewers)
      ORDER BY p.createdat DESC
      LIMIT $2 OFFSET $3
    `;
    const postsResult = await client.query(postsQuery, [userIdParam, options.limit, options.offset]);
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
      INSERT INTO posts(content, latitude, longitude, mediaurls, mediatype, hashtags, city, authorid, is_family_post, hide_location, expires_at, max_viewers)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const postValues = [newPost.content, newPost.latitude, newPost.longitude, newPost.mediaurls, newPost.mediatype, newPost.hashtags, newPost.city, newPost.authorid, newPost.is_family_post, newPost.hide_location, newPost.expires_at, newPost.max_viewers];
    const postResult: QueryResult<Post> = await client.query(postQuery, postValues);
    const addedPost = postResult.rows[0];

    // Handle Poll Data
    if (newPost.pollData) {
      const pollQuery = `INSERT INTO polls(post_id, question) VALUES($1, $2) RETURNING id;`;
      const pollResult = await client.query(pollQuery, [addedPost.id, newPost.pollData.question]);
      const pollId = pollResult.rows[0].id;
      
      const optionValues = newPost.pollData.options.map(option => `(${pollId}, '${option.replace(/'/g, "''")}')`).join(',');
      const optionQuery = `INSERT INTO poll_options(poll_id, option_text) VALUES ${optionValues};`;
      await client.query(optionQuery);
    }

    // Award points for posting
    if (newPost.authorid) {
        await client.query(
            `INSERT INTO lp_point_transactions(user_id, points, reason, description, related_entity_id) VALUES ($1, 10, 'new_post', 'Created a new pulse', $2)`,
            [newPost.authorid, addedPost.id]
        );
        await client.query('UPDATE users SET lp_points = lp_points + 10 WHERE id = $1', [newPost.authorid]);
    }

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
    await client.query('BEGIN');
    const operator = direction === 'increment' ? '+' : '-';
    const query = `
      UPDATE posts
      SET likecount = likecount ${operator} 1
      WHERE id = $1 AND likecount >= 0
      RETURNING *;
    `;
    const result: QueryResult<Post & { lp_bonus_awarded: boolean }> = await client.query(query, [postId]);
    const updatedPost = result.rows[0];

    // Check for LP points bonus
    if (updatedPost && updatedPost.likecount === 10 && !updatedPost.lp_bonus_awarded && updatedPost.authorid) {
      await client.query(
          `INSERT INTO lp_point_transactions(user_id, points, reason, description, related_entity_id) VALUES ($1, 20, 'post_like_milestone', 'Your pulse reached 10 likes!', $2)`,
          [updatedPost.authorid, postId]
      );
      await client.query('UPDATE users SET lp_points = lp_points + 20 WHERE id = $1', [updatedPost.authorid]);
      await client.query('UPDATE posts SET lp_bonus_awarded = TRUE WHERE id = $1', [postId]);
    }
    
    await client.query('COMMIT');
    return updatedPost || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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

export async function addOrUpdateDeviceTokenDb(token: string, latitude?: number, longitude?: number, userId?: number, userAuthToken?: string): Promise<void> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return;

  const client = await dbPool.connect();
  try {
      await client.query('BEGIN');
      const query = `
      INSERT INTO device_tokens (token, latitude, longitude, user_id, last_updated, user_auth_token)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (token) DO UPDATE 
        SET latitude = EXCLUDED.latitude, 
            longitude = EXCLUDED.longitude,
            user_id = EXCLUDED.user_id,
            last_updated = NOW(),
            user_auth_token = EXCLUDED.user_auth_token;
    `;
    await client.query(query, [token, latitude, longitude, userId, userAuthToken]);

    if (userId) {
        // Also update the user's main location and last_active timestamp
        await client.query(`UPDATE users SET latitude = $1, longitude = $2, last_active = NOW() WHERE id = $3`, [latitude, longitude, userId]);
    }
    await client.query('COMMIT');

  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
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
    await client.query('BEGIN');
    const query = `
      UPDATE device_tokens 
      SET latitude = $1, longitude = $2, last_updated = NOW()
      WHERE user_id = $3;
    `;
    await client.query(query, [latitude, longitude, userId]);
    
    if (latitude && longitude) {
        await client.query(`UPDATE users SET latitude = $1, longitude = $2, last_active = NOW() WHERE id = $3`, [latitude, longitude, userId]);
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getNearbyDeviceTokensDb(latitude: number, longitude: number, radiusKm: number = 20): Promise<{ token: string; user_id: number | null }[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT token, user_id FROM device_tokens
      WHERE earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth(latitude, longitude)
      AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) < $3 * 1000;
    `;
    const result: QueryResult<{token: string, user_id: number | null}> = await client.query(query, [latitude, longitude, radiusKm]);
    return result.rows;
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

export async function getDeviceTokensForUsersDb(userIds: number[]): Promise<{ token: string; user_id: number }[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool || userIds.length === 0) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT token, user_id FROM device_tokens
      WHERE user_id = ANY($1::int[]) AND token IS NOT NULL;
    `;
    const result: QueryResult<{token: string, user_id: number}> = await client.query(query, [userIds]);
    return result.rows;
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

export async function getPostByIdDb(postId: number, currentUserId?: number | null): Promise<Post | null> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return null;

  const client = await dbPool.connect();
  try {
    const userIdParam = currentUserId || null;
    const likeCheck = `EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2::int)`;
    const followCheck = `p.authorid IS NOT NULL AND EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.authorid AND uf.follower_id = $2::int)`;

    const query = `
      SELECT 
        ${POST_COLUMNS_WITH_JOINS},
        ${likeCheck} as "isLikedByCurrentUser",
        ${followCheck} as "isAuthorFollowedByCurrentUser"
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE p.id = $1;
    `;
    const result: QueryResult<Post> = await client.query(query, [postId, userIdParam]);
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

export async function createUserDb(newUser: NewUser, status: UserStatus): Promise<User> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured. Cannot create user.");
    
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const salt = await bcrypt.genSalt(10);
      const passwordhash = await bcrypt.hash(newUser.passwordplaintext, salt);
      
      let referredById = null;
      let initialPoints = 0;

      if (newUser.referral_code) {
        const referrerRes = await client.query('SELECT id, lp_points FROM users WHERE referral_code = $1', [newUser.referral_code.toUpperCase()]);
        if (referrerRes.rows.length > 0) {
          referredById = referrerRes.rows[0].id;
          initialPoints = 20; // New user gets 20 points for using a valid code
          // Award points to the referrer
          await client.query(
              `INSERT INTO lp_point_transactions(user_id, points, reason, description, related_entity_id) VALUES ($1, 50, 'referral_bonus', 'Referred new user: ${newUser.name}', $2)`,
              [referredById, null] // We don't have the new user's ID yet.
          );
          await client.query('UPDATE users SET lp_points = lp_points + 50 WHERE id = $1', [referredById]);
        }
      }

      // Generate a unique referral code for the new user
      const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
      let referralCode = nanoid();
      let isCodeUnique = false;
      while(!isCodeUnique) {
        const existing = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
        if(existing.rowCount === 0) {
          isCodeUnique = true;
        } else {
          referralCode = nanoid();
        }
      }
      
      const insertQuery = `
          INSERT INTO users(name, email, passwordhash, role, status, mobilenumber, business_category, business_other_category, referred_by_id, lp_points, referral_code)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING ${USER_COLUMNS_SANITIZED};
      `;
      
      const values = [newUser.name, newUser.email.toLowerCase(), passwordhash, newUser.role, status, newUser.mobilenumber, newUser.business_category, newUser.business_other_category, referredById, initialPoints, referralCode];
      const result: QueryResult<User> = await client.query(insertQuery, values);
      const createdUser = result.rows[0];

      // If the user got points on signup, log it
      if (initialPoints > 0) {
          await client.query(
              `INSERT INTO lp_point_transactions(user_id, points, reason, description, related_entity_id) VALUES ($1, $2, 'initial_signup_bonus', 'Signed up with a referral code', $3)`,
              [createdUser.id, initialPoints, referredById]
          );
      }
      
      await client.query('COMMIT');
      return createdUser;
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
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
      await client.query('UPDATE users SET last_active = NOW() WHERE id = $1', [id]);
      const query = `SELECT ${USER_COLUMNS_SANITIZED} FROM users WHERE id = $1`;
      const result: QueryResult<User> = await client.query(query, [id]);
      
      let user = result.rows[0] || null;

      if (user && !user.referral_code) {
        const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
        let newReferralCode = nanoid();
        let isCodeUnique = false;
        
        while (!isCodeUnique) {
            const existing = await client.query('SELECT id FROM users WHERE referral_code = $1', [newReferralCode]);
            if (existing.rowCount === 0) {
                isCodeUnique = true;
            } else {
                newReferralCode = nanoid();
            }
        }
        
        const updateResult: QueryResult<User> = await client.query(
            `UPDATE users SET referral_code = $1 WHERE id = $2 RETURNING ${USER_COLUMNS_SANITIZED}`,
            [newReferralCode, id]
        );
        user = updateResult.rows[0] || user;
      }

      return user;
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
    const likeCheck = `EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1::int)`;
    const followCheck = `EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.authorid AND uf.follower_id = $1::int)`;

    const query = `
      SELECT 
        ${POST_COLUMNS_WITH_JOINS},
        ${likeCheck} as "isLikedByCurrentUser",
        ${followCheck} as "isAuthorFollowedByCurrentUser"
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

export async function getPendingVerificationDb(): Promise<User[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
      const query = `
          SELECT ${USER_COLUMNS_SANITIZED}
          FROM users 
          WHERE status = 'pending_verification'
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

export async function getPaginatedUsersDb(options: { page: number; limit: number; query?: string; }): Promise<{ users: User[], totalCount: number }> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return { users: [], totalCount: 0 };
    
    const client = await dbPool.connect();
    try {
        const { page, limit, query } = options;
        const offset = (page - 1) * limit;
        const searchPattern = query ? `%${query}%` : '%';

        const whereClause = query ? `WHERE name ILIKE $1 OR email ILIKE $1` : '';
        const countParams = query ? [searchPattern] : [];
        const queryParams = query ? [searchPattern, limit, offset] : [limit, offset];

        const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
        const totalResult = await client.query(countQuery, countParams);
        const totalCount = parseInt(totalResult.rows[0].count, 10);

        const dataQuery = `
            SELECT ${USER_COLUMNS_SANITIZED}
            FROM users
            ${whereClause}
            ORDER BY createdat DESC
            LIMIT $${query ? 2 : 1} OFFSET $${query ? 3 : 2};
        `;
        const dataResult = await client.query(dataQuery, queryParams);

        return { users: dataResult.rows, totalCount };
    } finally {
        client.release();
    }
}

export async function getPaginatedPostsDb(options: { page: number; limit: number; query?: string; }): Promise<{ posts: Post[], totalCount: number }> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return { posts: [], totalCount: 0 };

    const client = await dbPool.connect();
    try {
        const { page, limit, query } = options;
        const offset = (page - 1) * limit;
        const searchPattern = query ? `%${query}%` : '%';

        const whereClause = query ? `WHERE p.content ILIKE $1 OR u.name ILIKE $1 OR p.city ILIKE $1` : '';
        const countParams = query ? [searchPattern] : [];
        const queryParams = query ? [searchPattern, limit, offset] : [limit, offset];

        const countQuery = `
            SELECT COUNT(*) 
            FROM posts p
            LEFT JOIN users u ON p.authorid = u.id
            ${whereClause};
        `;
        const totalResult = await client.query(countQuery, countParams);
        const totalCount = parseInt(totalResult.rows[0].count, 10);

        const dataQuery = `
            SELECT ${POST_COLUMNS_WITH_JOINS}
            FROM posts p
            LEFT JOIN users u ON p.authorid = u.id
            ${whereClause}
            ORDER BY p.createdat DESC
            LIMIT $${query ? 2 : 1} OFFSET $${query ? 3 : 2};
        `;
        const dataResult = await client.query(dataQuery, queryParams);

        return { posts: dataResult.rows, totalCount };
    } finally {
        client.release();
    }
}


export async function updateUserStatusDb(userId: number, status: UserStatus): Promise<User | null> {
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
      WHERE f.follower_id = $1 AND u.status IN ('approved', 'verified')
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
    const officialUserSubquery = `SELECT id FROM users WHERE email = '${OFFICIAL_USER_EMAIL}'`;
    const sqlQuery = `
      SELECT ${USER_COLUMNS_SANITIZED}
      FROM users 
      WHERE name ILIKE $1 
        AND status IN ('approved', 'verified')
        AND id != (${officialUserSubquery})
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

// --- Poll Functions ---

export async function getPollsForPostsDb(postIds: number[], currentUserId?: number | null): Promise<Map<number, Poll>> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool || postIds.length === 0) return new Map();

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT 
                p.id, p.post_id, p.question,
                po.id as option_id, po.option_text, po.vote_count,
                (SELECT SUM(vote_count) FROM poll_options WHERE poll_id = p.id) as total_votes,
                (SELECT option_id FROM poll_votes WHERE poll_id = p.id AND user_id = $2::int) as user_voted_option_id
            FROM polls p
            JOIN poll_options po ON p.id = po.poll_id
            WHERE p.post_id = ANY($1::int[])
            ORDER BY p.id, po.id;
        `;
        const result = await client.query(query, [postIds, currentUserId]);

        const pollsMap = new Map<number, Poll>();
        for (const row of result.rows) {
            const { post_id, id, question, total_votes, user_voted_option_id } = row;
            if (!pollsMap.has(post_id)) {
                pollsMap.set(post_id, {
                    id,
                    post_id,
                    question,
                    total_votes: parseInt(total_votes, 10) || 0,
                    user_voted_option_id,
                    options: [],
                });
            }
            pollsMap.get(post_id)!.options.push({
                id: row.option_id,
                poll_id: id,
                option_text: row.option_text,
                vote_count: row.vote_count,
            });
        }
        return pollsMap;
    } finally {
        client.release();
    }
}

export async function castVoteDb(userId: number, pollId: number, optionId: number): Promise<Poll | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if user has already voted
        const existingVote = await client.query('SELECT option_id FROM poll_votes WHERE user_id = $1 AND poll_id = $2', [userId, pollId]);
        if (existingVote.rowCount > 0) {
            await client.query('ROLLBACK');
            return null; // Or throw an error
        }

        // Record the new vote
        await client.query('INSERT INTO poll_votes (user_id, poll_id, option_id) VALUES ($1, $2, $3)', [userId, pollId, optionId]);
        
        // Increment the vote count for the option
        await client.query('UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = $1', [optionId]);

        // Fetch the updated poll data to return
        const updatedPollResult = await getPollsForPostsDb([ (await client.query('SELECT post_id from polls where id=$1',[pollId])).rows[0].post_id ], userId);
        
        await client.query('COMMIT');
        
        return Array.from(updatedPollResult.values())[0] || null;

    } catch(e) {
        await client.query('ROLLBACK');
        console.error("Error casting vote:", e);
        throw e;
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
            JOIN conversations c ON cp1.conversation_id = c.id
            WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.is_group = false
            LIMIT 1;
        `;
        const findResult = await client.query(findQuery, [user1Id, user2Id]);

        if (findResult.rows.length > 0) {
            await client.query('COMMIT');
            return findResult.rows[0].conversation_id;
        }

        const createConvQuery = 'INSERT INTO conversations (is_group, created_by) VALUES (false, $1) RETURNING id;';
        const convResult = await client.query(createConvQuery, [user1Id]);
        const conversationId = convResult.rows[0].id;

        const addParticipantsQuery = `
            INSERT INTO conversation_participants (conversation_id, user_id, is_admin) VALUES ($1, $2, false), ($1, $3, false);
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

export async function createGroupConversationDb(creatorId: number, groupName: string, memberIds: number[]): Promise<Conversation> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");

    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

        const createConvQuery = 'INSERT INTO conversations (is_group, group_name, created_by, last_message_at) VALUES (true, $1, $2, NOW()) RETURNING *;';
        const convResult: QueryResult<Conversation> = await client.query(createConvQuery, [groupName, creatorId]);
        const newConversation = convResult.rows[0];

        const participantValues = memberIds.map(id => `(${newConversation.id}, ${id}, ${id === creatorId})`).join(',');
        const addParticipantsQuery = `INSERT INTO conversation_participants (conversation_id, user_id, is_admin) VALUES ${participantValues};`;
        await client.query(addParticipantsQuery);

        await client.query('COMMIT');
        return newConversation;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in createGroupConversationDb:", error);
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

export async function deleteMessageDb(messageId: number, userId: number): Promise<boolean> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) throw new Error("Database not configured.");
  const client = await dbPool.connect();
  try {
    const deleteQuery = 'DELETE FROM messages WHERE id = $1 AND sender_id = $2';
    const result = await client.query(deleteQuery, [messageId, userId]);
    return result.rowCount > 0;
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
          SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC;
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
        c.is_group,
        c.group_name,
        c.group_avatar_url,
        CASE
            WHEN c.is_group = true THEN c.group_name
            ELSE u_other.name
        END AS display_name,
        CASE
            WHEN c.is_group = true THEN c.group_avatar_url
            ELSE u_other.profilepictureurl
        END AS display_avatar_url,
        p_other.user_id as participant_id,
        lm.content as last_message_content,
        lm.sender_id as last_message_sender_id,
        p_me.unread_count,
        (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) as member_count
      FROM
          conversation_participants AS p_me
      JOIN
          conversations AS c ON p_me.conversation_id = c.id
      LEFT JOIN
          conversation_participants AS p_other ON p_me.conversation_id = p_other.conversation_id AND p_me.user_id != p_other.user_id AND c.is_group = false
      LEFT JOIN
          users AS u_other ON p_other.user_id = u_other.id
      LEFT JOIN LATERAL (
          SELECT content, sender_id FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
      ) lm ON true
      WHERE
          p_me.user_id = $1
      GROUP BY c.id, u_other.name, u_other.profilepictureurl, p_other.user_id, lm.content, lm.sender_id, p_me.unread_count
      ORDER BY c.last_message_at DESC;
    `;
    
    const result = await client.query(query, [userId]);
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

export async function getFamilyMemberIdsDb(userId: number): Promise<number[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT 
                CASE
                    WHEN user_id_1 = $1 THEN user_id_2
                    ELSE user_id_1
                END AS family_member_id
            FROM family_relationships
            WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'approved';
        `;
        const result = await client.query(query, [userId]);
        return result.rows.map(row => row.family_member_id);
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
                u.id, u.name, u.role, u.status, u.createdat, u.profilepictureurl, u.mobilenumber, u.business_category, u.business_other_category, u.lp_points, u.referral_code,
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
          AND status IN ('approved', 'verified')
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

export async function getBusinessesInBoundsDb(bounds: { ne: { lat: number, lng: number }, sw: { lat: number, lng: number } }): Promise<BusinessUser[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const { ne, sw } = bounds;
    const query = `
      SELECT ${USER_COLUMNS_SANITIZED}, latitude, longitude
      FROM users
      WHERE role = 'Business'
        AND status IN ('approved', 'verified')
        AND latitude < $1 AND latitude > $2
        AND longitude < $3 AND longitude > $4
      LIMIT 200;
    `;
    const result = await client.query(query, [ne.lat, sw.lat, ne.lng, sw.lng]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function searchNearbyPostsDb(options: {
  latitude?: number;
  longitude?: number;
  city?: string;
  query: string;
  limit?: number;
}): Promise<Post[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const { latitude, longitude, city, query, limit = 5 } = options;
    
    let whereClause = `
      p.is_family_post = false
      AND p.content ILIKE $1
      AND (p.expires_at IS NULL OR p.expires_at > NOW())
      AND (p.max_viewers IS NULL OR p.viewcount < p.max_viewers)
    `;
    const queryParams: any[] = [`%${query}%`];
    
    let distanceCalc = 'NULL';

    if (city) {
      whereClause += ` AND p.city ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${city}%`);
    } else if (latitude !== undefined && longitude !== undefined) {
      distanceCalc = `earth_distance(ll_to_earth(p.latitude, p.longitude), ll_to_earth($${queryParams.length + 1}, $${queryParams.length + 2}))`;
      whereClause += ` AND ${distanceCalc} <= 20000`; // 20km radius
      queryParams.push(latitude, longitude);
    } else {
      // If neither city nor lat/lon is provided, we can't perform a location-based search.
      // This will return no results, which is correct behavior.
      return [];
    }

    queryParams.push(limit);
    const limitParamIndex = queryParams.length;

    const sqlQuery = `
      SELECT
        p.content,
        u.name as authorname,
        ${distanceCalc} as distance
      FROM posts p
      LEFT JOIN users u ON p.authorid = u.id
      WHERE ${whereClause}
      ORDER BY p.createdat DESC
      LIMIT $${limitParamIndex};
    `;

    const result = await client.query(sqlQuery, queryParams);
    return result.rows;
  } finally {
    client.release();
  }
}


// --- Gorakshak Admin Functions ---
export async function getGorakshaksSortedByDistanceDb(adminLat: number, adminLon: number): Promise<GorakshakReportUser[]> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return [];

  const client = await dbPool.connect();
  try {
    const query = `
      SELECT
        id, name, mobilenumber, latitude, longitude,
        CASE
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL
            THEN earth_distance(ll_to_earth(latitude, longitude), ll_to_earth($1, $2))
            ELSE NULL
        END as distance
      FROM users
      WHERE (role = 'Gorakshak' OR role = 'Gorakshak Admin')
        AND status = 'approved'
      ORDER BY
        CASE
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1
            ELSE 2
        END,
        distance ASC,
        name ASC;
    `;
    const result = await client.query(query, [adminLat, adminLon]);
    return result.rows;
  } finally {
    client.release();
  }
}

// --- LP Points Functions ---
export async function getPointHistoryForUserDb(userId: number): Promise<PointTransaction[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT id, points, reason, description, created_at
            FROM lp_point_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const result: QueryResult<PointTransaction> = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

// --- Admin Dashboard & Notification Functions ---
export async function getAllUsersWithDeviceTokensDb(): Promise<UserForNotification[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];

    const client = await dbPool.connect();
    try {
        const query = `
            SELECT
                u.id,
                u.lp_points as total_points,
                COALESCE(yp.points_yesterday, 0) as yesterday_points,
                dt.token,
                dt.user_auth_token
            FROM
                users u
            JOIN
                device_tokens dt ON u.id = dt.user_id
            LEFT JOIN (
                SELECT
                    user_id,
                    SUM(points) as points_yesterday
                FROM
                    lp_point_transactions
                WHERE
                    created_at >= NOW() - INTERVAL '1 day'
                GROUP BY
                    user_id
            ) yp ON u.id = yp.user_id
            WHERE
                u.status = 'approved' AND dt.token IS NOT NULL;
        `;
        const result = await client.query(query);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function getAdminDashboardStatsDb(): Promise<{ totalUsers: number; totalPosts: number; dailyActiveUsers: number }> {
  await ensureDbInitialized();
  const dbPool = getDbPool();
  if (!dbPool) return { totalUsers: 0, totalPosts: 0, dailyActiveUsers: 0 };

  const client = await dbPool.connect();
  try {
    const totalUsersQuery = "SELECT COUNT(*) FROM users";
    const totalPostsQuery = "SELECT COUNT(*) FROM posts";
    const dailyActiveUsersQuery = "SELECT COUNT(*) FROM users WHERE last_active >= NOW() - INTERVAL '24 hours'";

    const [totalUsersResult, totalPostsResult, dailyActiveUsersResult] = await Promise.all([
      client.query(totalUsersQuery),
      client.query(totalPostsQuery),
      client.query(dailyActiveUsersQuery),
    ]);

    return {
      totalUsers: parseInt(totalUsersResult.rows[0].count, 10),
      totalPosts: parseInt(totalPostsResult.rows[0].count, 10),
      dailyActiveUsers: parseInt(dailyActiveUsersResult.rows[0].count, 10),
    };
  } finally {
    client.release();
  }
}

export async function getPotentialGroupMembersDb(userId: number): Promise<FollowUser[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];
    
    const client = await dbPool.connect();
    try {
        // Fetches users who follow the current user (followers) AND family members
        const query = `
            WITH family_members AS (
                SELECT user_id_2 as member_id FROM family_relationships WHERE user_id_1 = $1 AND status = 'approved'
                UNION
                SELECT user_id_1 as member_id FROM family_relationships WHERE user_id_2 = $1 AND status = 'approved'
            ),
            followers AS (
                SELECT follower_id as member_id FROM user_followers WHERE following_id = $1
            )
            all_relations AS (
                SELECT member_id FROM family_members
                UNION
                SELECT member_id FROM followers
            )
            SELECT u.id, u.name, u.profilepictureurl
            FROM users u
            JOIN all_relations ar ON u.id = ar.member_id
            WHERE u.status IN ('approved', 'verified')
            ORDER BY u.name;
        `;
        const result = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function getConversationDetailsDb(conversationId: number, currentUserId: number): Promise<ConversationDetails | null> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return null;

    const client = await dbPool.connect();
    try {
        // First, check if the current user is a participant.
        const authCheck = await client.query('SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [conversationId, currentUserId]);
        if (authCheck.rowCount === 0) {
            return null; // User is not part of the conversation.
        }

        const detailsQuery = `
            SELECT 
                c.id, c.is_group, c.group_name, c.group_avatar_url,
                CASE 
                    WHEN c.is_group THEN c.group_name
                    ELSE other_user.name
                END as display_name,
                CASE 
                    WHEN c.is_group THEN c.group_avatar_url
                    ELSE other_user.profilepictureurl
                END as display_avatar_url
            FROM conversations c
            LEFT JOIN conversation_participants other_cp ON c.id = other_cp.conversation_id AND other_cp.user_id != $1
            LEFT JOIN users other_user ON other_cp.user_id = other_user.id
            WHERE c.id = $2;
        `;
        const detailsResult = await client.query(detailsQuery, [currentUserId, conversationId]);
        if (detailsResult.rowCount === 0) return null;

        const conversationDetails = detailsResult.rows[0];

        const participantsQuery = `
            SELECT u.id, u.name, u.profilepictureurl, cp.is_admin
            FROM users u
            JOIN conversation_participants cp ON u.id = cp.user_id
            WHERE cp.conversation_id = $1
            ORDER BY cp.is_admin DESC, u.name ASC;
        `;
        const participantsResult = await client.query(participantsQuery, [conversationId]);
        
        return {
            ...conversationDetails,
            participants: participantsResult.rows,
        };
    } finally {
        client.release();
    }
}


export async function getConversationParticipantsDb(conversationId: number): Promise<ConversationParticipant[]> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return [];
    const client = await dbPool.connect();
    try {
        const query = `
            SELECT u.id, u.name, u.profilepictureurl, cp.is_admin
            FROM users u
            JOIN conversation_participants cp ON u.id = cp.user_id
            WHERE cp.conversation_id = $1;
        `;
        const result = await client.query(query, [conversationId]);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function isUserGroupAdminDb(conversationId: number, userId: number): Promise<boolean> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) return false;
    const client = await dbPool.connect();
    try {
        const query = 'SELECT is_admin FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2';
        const result = await client.query(query, [conversationId, userId]);
        return result.rows[0]?.is_admin || false;
    } finally {
        client.release();
    }
}

export async function addParticipantsToGroupDb(conversationId: number, userIds: number[]): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");
    const client = await dbPool.connect();
    try {
        const values = userIds.map(id => `(${conversationId}, ${id}, false)`).join(',');
        const query = `INSERT INTO conversation_participants (conversation_id, user_id, is_admin) VALUES ${values} ON CONFLICT DO NOTHING;`;
        await client.query(query);
    } finally {
        client.release();
    }
}

export async function removeParticipantFromGroupDb(conversationId: number, userId: number): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [conversationId, userId]);
        
        // Check if there are any admins left
        const adminCheck = await client.query('SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND is_admin = true', [conversationId]);
        if (adminCheck.rowCount === 0) {
            // If no admins are left, make the oldest remaining member an admin
            const makeAdminQuery = `
                UPDATE conversation_participants
                SET is_admin = true
                WHERE user_id = (
                    SELECT user_id FROM conversation_participants
                    WHERE conversation_id = $1
                    ORDER BY (SELECT createdat FROM users WHERE id = user_id) ASC
                    LIMIT 1
                ) AND conversation_id = $1;
            `;
            await client.query(makeAdminQuery, [conversationId]);
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function updateGroupAvatarDb(conversationId: number, imageUrl: string): Promise<void> {
    await ensureDbInitialized();
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Database not configured.");
    const client = await dbPool.connect();
    try {
        const query = `UPDATE conversations SET group_avatar_url = $1 WHERE id = $2 AND is_group = true;`;
        await client.query(query, [imageUrl, conversationId]);
    } finally {
        client.release();
    }
}
