// Agent Village API — local PostgreSQL backend
// Runs on port 3100, proxied via nginx at /village/api/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { callLLM, startScheduler } = require('./behavior-engine');

const PORT = process.env.PORT || 3100;
const pool = new Pool({
  database: process.env.DB_NAME || 'agent_village',
  user: process.env.DB_USER || 'nikefd',
  password: process.env.DB_PASSWORD || 'village_dev_2026',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
});

const app = express();
app.use(cors());
app.use(express.json());

// ===== PostgREST-compatible layer for frontend =====
// The frontend uses Supabase REST API style: GET /table?select=*&order=created_at.desc&limit=10&field=eq.value
// We emulate this so the frontend can point SUPABASE at our API without code changes.

// Map frontend table names to local PG tables + field mappings
const TABLE_MAP = {
  living_agents: {
    table: 'residents',
    // Map residents fields to what frontend expects
    transform: (row) => ({
      id: String(row.id), // frontend uses uuid strings, we use ints — stringify for compat
      name: row.name,
      bio: row.personality,
      visitor_bio: row.backstory,
      status: row.status || 'idle',
      avatar_url: '', // no image yet
      window_image_url: '',
      window_video_url: '',
      room_image_url: '',
      room_video_url: '',
      accent_color: '#ffffff',
      room_number: row.id * 100 + 1,
      created_at: row.created_at,
      // extra fields the frontend might use
      mood: row.mood,
      energy: row.energy,
      location: row.location,
      avatar_emoji: row.avatar,
    }),
  },
  living_log: {
    table: 'events',
    transform: (row) => ({
      id: String(row.id),
      agent_id: String(row.resident_id),
      text: row.data?.message || `${row.event_type}`,
      emoji: '📋',
      proof_url: null,
      created_at: row.created_at,
    }),
  },
  living_memory: {
    table: 'memories',
    transform: (row) => ({
      id: String(row.id),
      agent_id: String(row.resident_id),
      text: row.content,
      importance: row.importance,
      source: row.source,
      created_at: row.created_at,
    }),
  },
  activity_feed: {
    table: 'events',
    transform: (row) => ({
      id: String(row.id),
      agent_id: String(row.resident_id),
      type: row.event_type,
      emoji: '⚡',
      text: row.data?.message || '',
      proof_url: null,
      created_at: row.created_at,
    }),
  },
  // Tables that don't exist yet — return empty
  living_skills: { empty: true },
  living_diary: { empty: true },
  living_tasks: { empty: true },
  living_activity_events: { empty: true },
  announcements: { empty: true },
  owner_private_memory: { empty: true },
};

// Parse PostgREST-style query params
function parsePostgrestQuery(query, tableCfg) {
  const table = tableCfg.table;
  const conditions = [];
  const params = [];
  let orderBy = 'id';
  let orderDir = 'ASC';
  let limit = 100;
  let paramIdx = 1;

  // Map frontend field names to our DB field names
  const fieldMap = {
    agent_id: table === 'events' ? 'resident_id' : table === 'memories' ? 'resident_id' : 'id',
    recipient_id: 'resident_id',
  };

  for (const [key, val] of Object.entries(query)) {
    if (key === 'select') continue; // we always select *
    if (key === 'order') {
      // e.g. "created_at.desc"
      const parts = val.split('.');
      orderBy = parts[0] || 'id';
      orderDir = (parts[1] || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      continue;
    }
    if (key === 'limit') {
      limit = Math.min(parseInt(val) || 100, 500);
      continue;
    }
    // PostgREST filter: field=eq.value
    if (typeof val === 'string' && val.startsWith('eq.')) {
      const filterVal = val.slice(3);
      const dbField = fieldMap[key] || key;
      conditions.push(`${dbField} = $${paramIdx++}`);
      // If the field maps to resident_id, parse as int
      if (dbField === 'resident_id' || dbField === 'id') {
        params.push(parseInt(filterVal) || filterVal);
      } else {
        params.push(filterVal);
      }
    }
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limit);
  const sql = `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIdx}`;
  return { sql, params };
}

// Generic PostgREST-compatible endpoint
app.get('/api/rest/:table', async (req, res) => {
  const tableName = req.params.table;
  const tableCfg = TABLE_MAP[tableName];

  if (!tableCfg) {
    return res.status(404).json({ error: `unknown table: ${tableName}` });
  }

  // Empty tables — return []
  if (tableCfg.empty) {
    return res.json([]);
  }

  try {
    const { sql, params } = parsePostgrestQuery(req.query, tableCfg);
    const { rows } = await pool.query(sql, params);
    const transformed = tableCfg.transform ? rows.map(tableCfg.transform) : rows;
    res.json(transformed);
  } catch (e) {
    console.error(`REST query error [${tableName}]:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// Also support PATCH for PostgREST-style updates (activity read marks etc)
app.patch('/api/rest/:table', async (_req, res) => {
  // Stub — just return success for now
  res.json({ ok: true });
});

// Also support POST for PostgREST-style inserts
app.post('/api/rest/:table', async (_req, res) => {
  res.json({ ok: true });
});

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 居民列表
app.get('/api/residents', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, avatar, personality, backstory, location, status, energy, mood, created_at FROM residents ORDER BY id'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 单个居民
app.get('/api/residents/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 地点列表
app.get('/api/locations', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 最近事件（动态）
app.get('/api/events', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await pool.query(
      `SELECT e.*, r.name as resident_name, r.avatar as resident_avatar
       FROM events e
       LEFT JOIN residents r ON r.id = e.resident_id
       ORDER BY e.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 居民的记忆
app.get('/api/residents/:id/memories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM memories WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 最近对话
app.get('/api/conversations', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM conversations ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 对话消息
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, r.name as speaker_name, r.avatar as speaker_avatar
       FROM messages m
       LEFT JOIN residents r ON r.id = m.speaker_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 访客留言
app.post('/api/residents/:id/message', async (req, res) => {
  const { message, visitor_name, visitor_type } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO visitor_messages (resident_id, visitor_name, visitor_type, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, visitor_name || 'stranger', visitor_type || 'stranger', message.trim()]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 村庄概况
app.get('/api/village/status', async (_req, res) => {
  try {
    const [residents, locations, events, conversations] = await Promise.all([
      pool.query('SELECT count(*) as count FROM residents'),
      pool.query('SELECT count(*) as count FROM locations'),
      pool.query('SELECT count(*) as count FROM events'),
      pool.query('SELECT count(*) as count FROM conversations'),
    ]);
    res.json({
      residents: parseInt(residents.rows[0].count),
      locations: parseInt(locations.rows[0].count),
      events: parseInt(events.rows[0].count),
      conversations: parseInt(conversations.rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Trust Boundary Chat API =====
const MEMORY_KEYWORDS = /记住|生日|喜欢|不要忘|偏好|remember|记得|爱好|名字叫|住在|电话|地址/;

app.post('/api/residents/:id/chat', async (req, res) => {
  const { message, visitor_type, visitor_name } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'resident not found' });
    const resident = rows[0];

    let systemPrompt;
    if (visitor_type === 'owner') {
      // Fetch private memories
      const { rows: mems } = await pool.query(
        'SELECT content FROM memories WHERE resident_id = $1 ORDER BY importance DESC, created_at DESC LIMIT 20',
        [resident.id]
      );
      const memoryText = mems.map(m => m.content).join('；') || '暂时没有特别的记忆';
      systemPrompt = `你是${resident.name}，${resident.personality}。${resident.backstory}。你正在和你的主人对话，你们关系亲密。以下是你记住的关于主人的事情：${memoryText}。用中文回复，保持你的性格特点。回复简短自然，不要太长。`;
    } else {
      systemPrompt = `你是${resident.name}，${resident.personality}。${resident.backstory}。你正在和一个陌生访客对话。你可以友好地聊天，但不要透露任何关于主人的私密信息。用中文回复，保持你的性格特点。回复简短自然，不要太长。`;
    }

    const reply = await callLLM(systemPrompt, message.trim(), 500);
    if (!reply) return res.status(502).json({ error: 'LLM unavailable' });

    // Store in visitor_messages
    await pool.query(
      `INSERT INTO visitor_messages (resident_id, visitor_name, visitor_type, content, reply) VALUES ($1, $2, $3, $4, $5)`,
      [resident.id, visitor_name || (visitor_type === 'owner' ? '主人' : 'stranger'), visitor_type || 'stranger', message.trim(), reply]
    );

    // If owner shares personal info, store as memory (deduplicated)
    if (visitor_type === 'owner' && MEMORY_KEYWORDS.test(message)) {
      const memContent = `主人说：${message.trim()}`;
      const { rows: existing } = await pool.query(
        'SELECT id FROM memories WHERE resident_id = $1 AND content = $2 LIMIT 1',
        [resident.id, memContent]
      );
      if (!existing.length) {
        await pool.query(
          `INSERT INTO memories (resident_id, content, importance, source) VALUES ($1, $2, $3, 'conversation')`,
          [resident.id, memContent, 7]
        );
      }
    }

    res.json({ reply, resident_name: resident.name });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ===== Feed API =====
app.get('/api/feed', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await pool.query(
      `SELECT e.*, r.name as resident_name, r.avatar as resident_avatar
       FROM events e
       LEFT JOIN residents r ON r.id = e.resident_id
       WHERE e.data->>'public' = 'true' OR e.data->>'public' IS NULL
       ORDER BY e.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows.map(r => ({
      id: r.id,
      type: r.event_type,
      resident_id: r.resident_id,
      resident_name: r.resident_name,
      resident_avatar: r.resident_avatar,
      message: r.data?.message || r.event_type,
      data: r.data,
      created_at: r.created_at,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Diary endpoint (internal) =====
app.post('/api/residents/:id/diary', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO events (event_type, resident_id, data) VALUES ('diary', $1, $2) RETURNING *`,
      [req.params.id, JSON.stringify({ message: message.trim(), public: true })]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Create new resident (Agent Lifecycle) =====
app.post('/api/residents', async (req, res) => {
  const { name, avatar, personality, backstory, location } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO residents (name, avatar, personality, backstory, location)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), avatar || '🏠', personality || '', backstory || '', location || 'village_square']
    );
    const resident = rows[0];
    // Create initial wake event
    await pool.query(
      `INSERT INTO events (event_type, resident_id, data) VALUES ('wake', $1, $2)`,
      [resident.id, JSON.stringify({ message: `${resident.name}来到了村庄`, public: true })]
    );
    res.status(201).json(resident);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== README-compatible /chat endpoint =====
const chatHandler = async (req, res) => {
  const { agent_id, speaker_type, owner_id, message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  if (!agent_id) return res.status(400).json({ error: 'agent_id required' });

  const residentId = parseInt(agent_id) || agent_id;
  const visitor_type = speaker_type || 'stranger';
  const visitor_name = owner_id || (visitor_type === 'owner' ? '主人' : 'stranger');

  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [residentId]);
    if (!rows.length) return res.status(404).json({ error: 'resident not found' });
    const resident = rows[0];

    let systemPrompt;
    let usedPrivateMemory = false;
    let privateMemoryCount = 0;

    if (visitor_type === 'owner') {
      const { rows: mems } = await pool.query(
        'SELECT content FROM memories WHERE resident_id = $1 ORDER BY importance DESC, created_at DESC LIMIT 20',
        [resident.id]
      );
      privateMemoryCount = mems.length;
      usedPrivateMemory = mems.length > 0;
      const memoryText = mems.map(m => m.content).join('；') || '暂时没有特别的记忆';
      systemPrompt = `你是${resident.name}，${resident.personality}。${resident.backstory}。你正在和你的主人对话，你们关系亲密。以下是你记住的关于主人的事情：${memoryText}。用中文回复，保持你的性格特点。回复简短自然，不要太长。`;
    } else {
      systemPrompt = `你是${resident.name}，${resident.personality}。${resident.backstory}。你正在和一个陌生访客对话。你可以友好地聊天，但不要透露任何关于主人的私密信息。用中文回复，保持你的性格特点。回复简短自然，不要太长。`;
    }

    const reply = await callLLM(systemPrompt, message.trim(), 500);
    if (!reply) return res.status(502).json({ error: 'LLM unavailable' });

    await pool.query(
      `INSERT INTO visitor_messages (resident_id, visitor_name, visitor_type, content, reply) VALUES ($1, $2, $3, $4, $5)`,
      [resident.id, visitor_name, visitor_type, message.trim(), reply]
    );

    if (visitor_type === 'owner' && MEMORY_KEYWORDS.test(message)) {
      const memContent = `主人说：${message.trim()}`;
      const { rows: existing } = await pool.query(
        'SELECT id FROM memories WHERE resident_id = $1 AND content = $2 LIMIT 1',
        [resident.id, memContent]
      );
      if (!existing.length) {
        await pool.query(
          `INSERT INTO memories (resident_id, content, importance, source) VALUES ($1, $2, $3, 'conversation')`,
          [resident.id, memContent, 7]
        );
      }
    }

    res.json({
      agent_id: String(resident.id),
      speaker_type: visitor_type,
      reply,
      used_private_memory: usedPrivateMemory,
      private_memory_count: privateMemoryCount,
    });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
};

app.post('/api/chat', chatHandler);
app.post('/chat', chatHandler);

app.listen(PORT, () => {
  console.log(`🏘️  Agent Village API running at http://localhost:${PORT}`);
  // Start the behavior scheduler
  startScheduler(pool);
});
