-- StreamSphere Database Schema
-- Run this in your Supabase SQL Editor
-- Users table (updated)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    meeting_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255),
    host_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ACTIVE', 'ENDED')),
    started_at TIMESTAMP
    WITH
        TIME ZONE,
        ended_at TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting participants
CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'PARTICIPANT' CHECK (role IN ('HOST', 'PARTICIPANT')),
    joined_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP
    WITH
        TIME ZONE
);

-- Chat messages (persisted)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'SYSTEM')),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_code ON meetings (meeting_code);

CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings (host_id);

CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants (meeting_id);

CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_meeting ON chat_messages (meeting_id);