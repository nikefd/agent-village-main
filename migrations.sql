-- Add owner-private memory table for trust-boundary separation
-- Run this after setup-database.sql

CREATE TABLE IF NOT EXISTS owner_private_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES living_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_private_memory_agent_owner_created
ON owner_private_memory(agent_id, owner_id, created_at DESC);

ALTER TABLE owner_private_memory ENABLE ROW LEVEL SECURITY;

-- Only service role should access owner-private memory
DROP POLICY IF EXISTS "service_all_owner_private_memory" ON owner_private_memory;
CREATE POLICY "service_all_owner_private_memory"
ON owner_private_memory
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Stream agent ID mapping column used by DM integration
ALTER TABLE living_agents
ADD COLUMN IF NOT EXISTS platform_agent_id TEXT;

-- Missing tables used by frontend (tasks panel + share action)
CREATE TABLE IF NOT EXISTS living_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES living_agents(id) ON DELETE CASCADE,
    title TEXT,
    state TEXT DEFAULT 'planning',
    events JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_living_tasks_agent_created
ON living_tasks(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS living_world (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES living_agents(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    media_url TEXT,
    task_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_living_world_created
ON living_world(created_at DESC);

ALTER TABLE living_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE living_world ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_living_tasks" ON living_tasks;
DROP POLICY IF EXISTS "anon_write_living_tasks" ON living_tasks;
DROP POLICY IF EXISTS "service_all_living_tasks" ON living_tasks;
DROP POLICY IF EXISTS "anon_read_living_world" ON living_world;
DROP POLICY IF EXISTS "anon_write_living_world" ON living_world;
DROP POLICY IF EXISTS "service_all_living_world" ON living_world;

-- Prototype mode: allow frontend anon key to read/write these two tables.
CREATE POLICY "anon_read_living_tasks" ON living_tasks FOR SELECT USING (true);
CREATE POLICY "anon_write_living_tasks" ON living_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_living_tasks" ON living_tasks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_read_living_world" ON living_world FOR SELECT USING (true);
CREATE POLICY "anon_write_living_world" ON living_world FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_living_world" ON living_world FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
