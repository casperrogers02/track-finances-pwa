CREATE TABLE IF NOT EXISTS ai_chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id ON ai_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chats_created_at ON ai_chats(created_at);
