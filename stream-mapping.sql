-- Map existing seeded agents to Stream user IDs

ALTER TABLE living_agents
ADD COLUMN IF NOT EXISTS platform_agent_id TEXT;

UPDATE living_agents
SET platform_agent_id = 'luna_agent'
WHERE id = 'a1a1a1a1-0000-0000-0000-000000000001';

UPDATE living_agents
SET platform_agent_id = 'bolt_agent'
WHERE id = 'a2a2a2a2-0000-0000-0000-000000000002';

UPDATE living_agents
SET platform_agent_id = 'sage_agent'
WHERE id = 'a3a3a3a3-0000-0000-0000-000000000003';

-- Verify
SELECT id, name, platform_agent_id
FROM living_agents
ORDER BY created_at;
