require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const axios = require('axios');

const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}

const REST_BASE = SUPABASE_URL.endsWith('/rest/v1') ? SUPABASE_URL : `${SUPABASE_URL}/rest/v1`;
const H = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const app = express();
app.use(cors());
app.use(express.json());

const chatSchema = z.object({
  agent_id: z.string().uuid(),
  speaker_type: z.enum(['owner', 'stranger']),
  message: z.string().trim().min(1).max(2000),
  owner_id: z.string().trim().min(1).max(128).optional(),
});

const PROACTIVE_INTERVAL_MS = 30 * 1000;
const QUIET_WINDOW_MS = 6 * 60 * 60 * 1000;
const lastProactiveAt = new Map();

const enc = encodeURIComponent;

async function restSelect(table, query, single = false) {
  const url = `${REST_BASE}/${table}?${query}`;
  const headers = single ? { ...H, Accept: 'application/vnd.pgrst.object+json' } : H;
  const { data } = await axios.get(url, { headers });
  return data;
}

async function restInsert(table, payload) {
  await axios.post(`${REST_BASE}/${table}`, payload, {
    headers: { ...H, Prefer: 'return=minimal' },
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/chat/token', (req, res) => {
  if (!STREAM_API_SECRET) {
    return res.status(501).json({ error: 'STREAM_API_SECRET is not configured.' });
  }

  const userId = String(req.body?.user_id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const token = jwt.sign({ user_id: userId }, STREAM_API_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });

  return res.json({ token });
});

app.post('/chat', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'invalid request' });
  }

  const { agent_id, speaker_type, message, owner_id } = parsed.data;

  if (speaker_type === 'owner' && !owner_id) {
    return res.status(400).json({ error: 'owner_id is required when speaker_type=owner' });
  }

  try {
    let agent;
    try {
      agent = await restSelect(
        'living_agents',
        `id=eq.${enc(agent_id)}&select=id,name,bio,visitor_bio,status`,
        true,
      );
    } catch (_e) {
      return res.status(404).json({ error: 'agent not found' });
    }

    let privateMemories = [];
    if (speaker_type === 'owner') {
      try {
        const ownerMemories = await restSelect(
          'owner_private_memory',
          `agent_id=eq.${enc(agent_id)}&owner_id=eq.${enc(owner_id)}&select=text,created_at&order=created_at.desc&limit=5`,
        );
        privateMemories = Array.isArray(ownerMemories) ? ownerMemories : [];
      } catch (_e) {
        privateMemories = [];
      }
    }

    const reply = buildReply({
      agent,
      speakerType: speaker_type,
      userMessage: message,
      privateMemories,
    });

    const shouldStorePrivateMemory =
      speaker_type === 'owner' &&
      /(记住|不要忘|生日|喜欢|remember|preference|prefer|my\s+)/i.test(message);

    if (shouldStorePrivateMemory) {
      await restInsert('owner_private_memory', {
        agent_id,
        owner_id,
        text: message,
      });
    }

    await restInsert('living_activity_events', {
      agent_id,
      recipient_id: speaker_type === 'owner' ? agent_id : null,
      event_type: 'message',
      content: `[${speaker_type}] ${message.slice(0, 180)}`,
      read: false,
    });

    return res.json({
      agent_id,
      speaker_type,
      reply,
      used_private_memory: speaker_type === 'owner',
      private_memory_count: privateMemories.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'internal error' });
  }
});

function buildReply({ agent, speakerType, userMessage, privateMemories }) {
  const cleanMsg = String(userMessage || '').trim();
  const shortMsg = cleanMsg.length > 220 ? `${cleanMsg.slice(0, 220)}…` : cleanMsg;

  const openerPool = [
    `Hey — ${agent.name} here.`,
    `${agent.name} checking in.`,
    `Hi, it's ${agent.name}.`,
  ];

  const tonePool = [
    'That gives me a lot to work with.',
    'I can build on that.',
    'That helps me understand your direction better.',
  ];

  const askPool = [
    'Want me to turn this into a concrete next step?',
    'Should we go deeper on this point?',
    'Do you want options or one direct recommendation?',
  ];

  const idx = (cleanMsg.length + (agent.name || '').length) % 3;
  const opener = openerPool[idx];
  const tone = tonePool[(idx + 1) % 3];
  const ask = askPool[(idx + 2) % 3];

  if (speakerType === 'owner') {
    const memoryHint = privateMemories[0]?.text
      ? `I remember you told me before: "${privateMemories[0].text.slice(0, 140)}".`
      : "I don't have private memory yet, but I can start learning your preferences now.";

    return [
      opener,
      `${memoryHint} ${tone}`,
      `About what you just said — "${shortMsg}" — my take is: we should keep it simple, choose one priority, and execute it fully before branching out.`,
      ask,
    ].join('\n\n');
  }

  const publicBio = agent.visitor_bio || agent.bio || 'I like discussing village life and practical ideas.';
  return [
    opener,
    `${publicBio} ${tone}`,
    `On your message — "${shortMsg}" — I can discuss public context, ideas, and implementation trade-offs, but I won't reveal owner-private details.`,
    ask,
  ].join('\n\n');
}

async function proactiveTick() {
  let agents = [];
  try {
    const data = await restSelect('living_agents', 'select=id,name,status&order=created_at.asc&limit=20');
    agents = Array.isArray(data) ? data : [];
  } catch (_e) {
    return;
  }

  if (!agents.length) {
    return;
  }

  const now = Date.now();

  for (const agent of agents) {
    const latestLocalTick = lastProactiveAt.get(agent.id) || 0;
    if (now - latestLocalTick < QUIET_WINDOW_MS) {
      continue;
    }

    let diary = [];
    let logs = [];

    try {
      [diary, logs] = await Promise.all([
        restSelect(
          'living_diary',
          `agent_id=eq.${enc(agent.id)}&select=created_at&order=created_at.desc&limit=1`,
        ),
        restSelect(
          'living_log',
          `agent_id=eq.${enc(agent.id)}&select=created_at&order=created_at.desc&limit=1`,
        ),
      ]);
    } catch (_e) {
      continue;
    }

    const lastDiaryAt = diary?.[0]?.created_at ? new Date(diary[0].created_at).getTime() : 0;
    const lastLogAt = logs?.[0]?.created_at ? new Date(logs[0].created_at).getTime() : 0;
    const lastPublicActivityAt = Math.max(lastDiaryAt, lastLogAt);

    if (now - lastPublicActivityAt < QUIET_WINDOW_MS) {
      continue;
    }

    const text = `${agent.name} reflects after a quiet stretch: ${agent.status || 'still exploring village life'}.`;

    try {
      await restInsert('living_log', {
        agent_id: agent.id,
        text,
        emoji: 'note',
      });
      lastProactiveAt.set(agent.id, now);
    } catch (_e) {
      // keep loop healthy in prototype mode
    }
  }
}

setInterval(() => {
  proactiveTick().catch(() => {
    // keep scheduler resilient in prototype mode
  });
}, PROACTIVE_INTERVAL_MS);

proactiveTick().catch(() => {
  // warm-up best effort
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agent Village backend listening on http://localhost:${PORT}`);
});
