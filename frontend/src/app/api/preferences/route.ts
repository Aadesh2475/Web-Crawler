import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import fs from 'fs';
import path from 'path';

// Simple file-based DB for preferences to avoid Prisma schema migrations for now
const PREF_FILE = path.join(process.cwd(), 'data', 'preferences.json');

function readPrefs() {
  try {
    if (fs.existsSync(PREF_FILE)) {
      return JSON.parse(fs.readFileSync(PREF_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function writePrefs(data: any) {
  try {
    if (!fs.existsSync(path.dirname(PREF_FILE))) {
      fs.mkdirSync(path.dirname(PREF_FILE), { recursive: true });
    }
    fs.writeFileSync(PREF_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

export async function GET() {
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({});
  
  const allPrefs = readPrefs();
  return NextResponse.json(allPrefs[session.user.email] || {});
}

export async function POST(req: NextRequest) {
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allPrefs = readPrefs();
  allPrefs[session.user.email] = { ...allPrefs[session.user.email], ...body };
  writePrefs(allPrefs);

  return NextResponse.json({ success: true, preferences: allPrefs[session.user.email] });
}
