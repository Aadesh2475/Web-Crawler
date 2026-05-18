from dotenv import load_dotenv
import os, psycopg2
load_dotenv('../.env')

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

tables = [
    '''CREATE TABLE IF NOT EXISTS "User" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        image TEXT,
        provider TEXT DEFAULT 'google',
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )''',
    '''CREATE TABLE IF NOT EXISTS "Chat" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        model TEXT DEFAULT 'newsler',
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )''',
    '''CREATE TABLE IF NOT EXISTS "Message" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "chatId" TEXT NOT NULL REFERENCES "Chat"(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        "fileNames" TEXT[] DEFAULT '{}',
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )''',
    '''CREATE TABLE IF NOT EXISTS "Feedback" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "messageId" TEXT NOT NULL REFERENCES "Message"(id) ON DELETE CASCADE,
        "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
        value INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE("messageId", "userId")
    )''',
]

for sql in tables:
    name = sql.strip().split('"')[1]
    cur.execute(sql)
    print(f'  OK: {name}')

conn.commit()
cur.close()
conn.close()
print('All tables created.')
