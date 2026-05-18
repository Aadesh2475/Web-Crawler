import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return NextResponse.json({ status: 'online' });
}

// POST /api/feedback — submit thumbs up/down
export async function POST(req: NextRequest) {
  const { messageId, value } = await req.json(); // value: 1 or -1
  if (!messageId || ![1, -1].includes(value)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      create: {
        email: session.user.email,
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
        provider: 'oauth',
      },
      update: {},
    });
    userId = user.id;
  }

  const feedback = await prisma.feedback.upsert({
    where: {
      messageId_userId: { messageId, userId: userId ?? '' },
    },
    create: { messageId, userId, value },
    update: { value },
  });

  return NextResponse.json({ ok: true, feedback });
}
