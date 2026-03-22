-- Agent Village Schema
-- Run: psql -d agent_village -f schema.sql

-- 居民表
CREATE TABLE IF NOT EXISTS residents (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(64) NOT NULL UNIQUE,
  avatar        VARCHAR(16) DEFAULT '🤖',
  personality   TEXT,            -- 性格描述/system prompt 片段
  backstory     TEXT,            -- 背景故事
  location      VARCHAR(64) DEFAULT 'village_square',
  status        VARCHAR(32) DEFAULT 'idle',  -- idle, walking, talking, sleeping
  energy        INT DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
  mood          VARCHAR(32) DEFAULT 'neutral',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 地点表
CREATE TABLE IF NOT EXISTS locations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(64) NOT NULL UNIQUE,
  label         VARCHAR(128),    -- 显示名
  description   TEXT,
  capacity      INT DEFAULT 10,
  x             INT DEFAULT 0,   -- 地图坐标
  y             INT DEFAULT 0
);

-- 对话记录
CREATE TABLE IF NOT EXISTS conversations (
  id            SERIAL PRIMARY KEY,
  participants  INT[] NOT NULL,  -- resident ids
  location      VARCHAR(64),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  summary       TEXT             -- LLM 生成的摘要
);

-- 消息
CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id),
  speaker_id    INT REFERENCES residents(id),
  content       TEXT NOT NULL,
  msg_type      VARCHAR(16) DEFAULT 'chat',  -- chat, action, thought, narration
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 记忆（agent 的长期记忆）
CREATE TABLE IF NOT EXISTS memories (
  id            SERIAL PRIMARY KEY,
  resident_id   INT REFERENCES residents(id),
  content       TEXT NOT NULL,
  importance    INT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source        VARCHAR(32),     -- conversation, observation, reflection
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 访客留言（owner 和 stranger 的对话）
CREATE TABLE IF NOT EXISTS visitor_messages (
  id            SERIAL PRIMARY KEY,
  resident_id   INT REFERENCES residents(id),
  visitor_name  VARCHAR(64) DEFAULT 'stranger',
  visitor_type  VARCHAR(16) DEFAULT 'stranger',  -- owner, stranger
  content       TEXT NOT NULL,
  reply         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 事件日志（用于前端展示动态）
CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  event_type    VARCHAR(32) NOT NULL,  -- move, talk, sleep, wake, mood_change
  resident_id   INT REFERENCES residents(id),
  data          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_memories_resident ON memories(resident_id);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_visitor_messages_resident ON visitor_messages(resident_id);
