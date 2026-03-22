// Behavior Engine — proactive agent actions
const fetch = require('node-fetch');

const LLM_URL = process.env.LLM_URL || 'http://127.0.0.1:18789/v1/chat/completions';
const LLM_KEY = process.env.LLM_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'github-copilot/claude-sonnet-4';

const LOCATIONS = ['village_square', 'cafe', 'library', 'park', 'workshop', 'home_district'];

// Time periods (UTC)
function getTimePeriod() {
  const h = new Date().getUTCHours();
  if (h >= 22 || h < 7) return 'night';
  if (h < 8) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 13) return 'lunch';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// Personality-driven location preferences (multiple options per period for variety)
const LOCATION_PREFS = {
  '小明': { morning: ['cafe','library'], afternoon: ['library','park'], evening: ['cafe','home_district'], lunch: ['village_square','cafe'], dawn: ['home_district','cafe'] },
  '阿花': { morning: ['village_square','park'], afternoon: ['park','cafe'], evening: ['village_square','cafe'], lunch: ['village_square','cafe'], dawn: ['home_district','village_square'] },
  '老王': { morning: ['library','park'], afternoon: ['library','cafe'], evening: ['home_district','village_square'], lunch: ['cafe','village_square'], dawn: ['library','home_district'] },
  '铁柱': { morning: ['workshop','village_square'], afternoon: ['workshop','park'], evening: ['village_square','cafe'], lunch: ['village_square','cafe'], dawn: ['workshop','home_district'] },
  '小美': { morning: ['park','cafe'], afternoon: ['cafe','library'], evening: ['park','home_district'], lunch: ['village_square','park'], dawn: ['park','home_district'] },
};

// Personality action weights: [diary, move, mood, talk]
const ACTION_WEIGHTS = {
  '小明': [0.15, 0.35, 0.1, 0.3],
  '阿花': [0.1, 0.3, 0.1, 0.45],
  '老王': [0.25, 0.3, 0.1, 0.2],
  '铁柱': [0.1, 0.3, 0.15, 0.35],
  '小美': [0.2, 0.35, 0.15, 0.2],
};

async function callLLM(systemPrompt, userMessage, maxTokens = 300) {
  try {
    const res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('LLM call failed:', e.message);
    return null;
  }
}

async function writeDiary(pool, resident) {
  const period = getTimePeriod();
  const periodCN = { dawn: '清晨', morning: '上午', lunch: '午间', afternoon: '下午', evening: '傍晚', night: '夜晚' }[period];
  
  // Get recent events for context
  const { rows: recentEvents } = await pool.query(
    `SELECT data->>'message' as msg FROM events WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [resident.id]
  );
  const context = recentEvents.map(e => e.msg).filter(Boolean).join('；');

  const sys = `你是${resident.name}，${resident.personality}。你正在写日记。用一两句话记录你的想法或感受，体现你的性格。不要太长。不要重复之前写过的内容。`;
  
  // Include recent diary entries to avoid repetition
  const { rows: recentDiaries } = await pool.query(
    `SELECT data->>'message' as msg FROM events WHERE resident_id = $1 AND event_type = 'diary' ORDER BY created_at DESC LIMIT 3`,
    [resident.id]
  );
  const prevDiaries = recentDiaries.map(d => d.msg).filter(Boolean);
  const avoidRepeat = prevDiaries.length ? `\n\n你最近已经写过这些日记，请写不同的内容：\n${prevDiaries.map(d => '- ' + d.slice(0, 60)).join('\n')}` : '';
  
  const prompt = `现在是${periodCN}，你在${resident.location}。${context ? '最近发生的事：' + context : ''}请写一段简短的日记。${avoidRepeat}`;

  const entry = await callLLM(sys, prompt, 200);
  if (!entry) return;

  await pool.query(
    `INSERT INTO events (event_type, resident_id, data) VALUES ('diary', $1, $2)`,
    [resident.id, JSON.stringify({ message: entry, public: true })]
  );
  console.log(`📝 ${resident.name} wrote diary: ${entry.slice(0, 50)}...`);
}

async function moveLocation(pool, resident) {
  const period = getTimePeriod();
  const prefs = LOCATION_PREFS[resident.name] || {};
  const options = prefs[period] || LOCATIONS;
  // Pick randomly from preferred locations, but exclude current location
  const candidates = (Array.isArray(options) ? options : [options]).filter(l => l !== resident.location);
  if (!candidates.length) return;
  const preferred = candidates[Math.floor(Math.random() * candidates.length)];

  const locationLabels = {
    village_square: '村广场', cafe: '咖啡馆', library: '图书馆',
    park: '公园', workshop: '工坊', home_district: '居民区'
  };
  const fromLabel = locationLabels[resident.location] || resident.location;
  const toLabel = locationLabels[preferred] || preferred;

  await pool.query(`UPDATE residents SET location = $1 WHERE id = $2`, [preferred, resident.id]);
  await pool.query(
    `INSERT INTO events (event_type, resident_id, data) VALUES ('move', $1, $2)`,
    [resident.id, JSON.stringify({ message: `${resident.name}从${fromLabel}走到了${toLabel}`, from: resident.location, to: preferred, public: true })]
  );
  resident.location = preferred;
  console.log(`🚶 ${resident.name} moved ${fromLabel} → ${toLabel}`);
}

async function changeMood(pool, resident) {
  const moods = ['happy', 'calm', 'curious', 'tired', 'excited', 'thoughtful', 'content'];
  const newMood = moods[Math.floor(Math.random() * moods.length)];
  if (newMood === resident.mood) return;

  await pool.query(`UPDATE residents SET mood = $1 WHERE id = $2`, [newMood, resident.id]);
  await pool.query(
    `INSERT INTO events (event_type, resident_id, data) VALUES ('mood_change', $1, $2)`,
    [resident.id, JSON.stringify({ message: `${resident.name}的心情变成了${newMood}`, from: resident.mood, to: newMood, public: true })]
  );
  resident.mood = newMood;
  console.log(`😊 ${resident.name} mood → ${newMood}`);
}

async function talkToNeighbor(pool, resident, allResidents) {
  let neighbors = allResidents.filter(r => r.id !== resident.id && r.location === resident.location && r.status !== 'sleeping');
  
  // If no one nearby, go find someone
  if (!neighbors.length) {
    const awake = allResidents.filter(r => r.id !== resident.id && r.status !== 'sleeping');
    if (!awake.length) return;
    const target = awake[Math.floor(Math.random() * awake.length)];
    // Move to their location
    const locationLabels = {
      village_square: '村广场', cafe: '咖啡馆', library: '图书馆',
      park: '公园', workshop: '工坊', home_district: '居民区'
    };
    await pool.query(`UPDATE residents SET location = $1 WHERE id = $2`, [target.location, resident.id]);
    await pool.query(
      `INSERT INTO events (event_type, resident_id, data) VALUES ('move', $1, $2)`,
      [resident.id, JSON.stringify({ message: `${resident.name}去${locationLabels[target.location] || target.location}找${target.name}`, from: resident.location, to: target.location, public: true })]
    );
    console.log(`🚶 ${resident.name} went to find ${target.name} at ${target.location}`);
    resident.location = target.location;
    neighbors = [target];
  }

  const other = neighbors[Math.floor(Math.random() * neighbors.length)];
  const sys = `你是${resident.name}，${resident.personality}。你在${resident.location}遇到了${other.name}（${other.personality}）。生成一段两人的简短对话（2-4句），格式：\n${resident.name}：...\n${other.name}：...\n用中文，体现双方性格。`;

  const dialogue = await callLLM(sys, '请生成对话', 300);
  if (!dialogue) return;

  // Create conversation
  const { rows } = await pool.query(
    `INSERT INTO conversations (participants, location) VALUES ($1, $2) RETURNING id`,
    [[resident.id, other.id], resident.location]
  );
  const convId = rows[0].id;

  // Store as event
  await pool.query(
    `INSERT INTO events (event_type, resident_id, data) VALUES ('talk', $1, $2)`,
    [resident.id, JSON.stringify({ message: `${resident.name}和${other.name}在${resident.location}聊天了`, dialogue, public: true })]
  );

  // End conversation with summary
  await pool.query(
    `UPDATE conversations SET ended_at = NOW(), summary = $1 WHERE id = $2`,
    [dialogue.slice(0, 200), convId]
  );

  console.log(`💬 ${resident.name} talked with ${other.name}`);
}

async function maybeTakeAction(pool, resident, allResidents) {
  const period = getTimePeriod();

  // Sleep cycle
  if (period === 'night') {
    if (resident.status !== 'sleeping') {
      await pool.query(`UPDATE residents SET status = 'sleeping' WHERE id = $1`, [resident.id]);
      await pool.query(
        `INSERT INTO events (event_type, resident_id, data) VALUES ('sleep', $1, $2)`,
        [resident.id, JSON.stringify({ message: `${resident.name}睡觉了`, public: true })]
      );
      resident.status = 'sleeping';
    }
    return;
  }

  if (resident.status === 'sleeping' && period === 'dawn') {
    await pool.query(`UPDATE residents SET status = 'idle', energy = LEAST(energy + 30, 100) WHERE id = $1`, [resident.id]);
    await pool.query(
      `INSERT INTO events (event_type, resident_id, data) VALUES ('wake', $1, $2)`,
      [resident.id, JSON.stringify({ message: `${resident.name}醒来了`, public: true })]
    );
    resident.status = 'idle';
    return;
  }

  if (resident.status === 'sleeping') return;

  // Check last activity - don't spam
  const { rows: lastAct } = await pool.query(
    `SELECT created_at FROM events WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [resident.id]
  );
  if (lastAct.length) {
    const minsSinceLastAct = (Date.now() - new Date(lastAct[0].created_at).getTime()) / 60000;
    if (minsSinceLastAct < 2) return; // At least 2 min between actions
  }

  // Energy-based activity probability
  const energyFactor = (resident.energy || 50) / 100;
  const baseProb = 0.5 * energyFactor;  // Higher probability = more lively village
  if (Math.random() > baseProb) return;

  // Pick action based on personality weights
  const weights = ACTION_WEIGHTS[resident.name] || [0.25, 0.2, 0.15, 0.2];
  const roll = Math.random();
  let cum = 0;

  const actions = [
    () => writeDiary(pool, resident),
    () => moveLocation(pool, resident),
    () => changeMood(pool, resident),
    () => talkToNeighbor(pool, resident, allResidents),
  ];

  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) {
      try { await actions[i](); } catch (e) { console.error(`Action error for ${resident.name}:`, e.message); }
      // Drain energy
      await pool.query(`UPDATE residents SET energy = GREATEST(energy - 5, 0) WHERE id = $1`, [resident.id]);
      return;
    }
  }
}

function startScheduler(pool) {
  console.log('🕐 Behavior scheduler started');

  setInterval(async () => {
    try {
      const { rows: allResidents } = await pool.query(
        'SELECT id, name, personality, backstory, location, status, energy, mood FROM residents'
      );
      for (const resident of allResidents) {
        await maybeTakeAction(pool, resident, allResidents);
      }
    } catch (e) {
      console.error('Scheduler error:', e.message);
    }
  }, 60000);

  // Energy regeneration every 5 minutes
  setInterval(async () => {
    try {
      await pool.query(`UPDATE residents SET energy = LEAST(energy + 3, 100) WHERE status != 'sleeping'`);
    } catch (e) {}
  }, 300000);
}

module.exports = { callLLM, startScheduler, getTimePeriod };
