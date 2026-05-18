import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { getServerSession } = await import('next-auth');
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const messages = await prisma.message.groupBy({
      by: ['model'],
      where: { 
          chat: { userId: user.id },
          role: 'assistant'
      },
      _count: { _all: true }
    });

    const userMessages = await prisma.message.findMany({
      where: {
         chat: { userId: user.id },
         role: 'user'
      },
      select: { fileNames: true }
    });

    let newslerQueries = 0;
    let geminiQueries = 0;
    let filesAnalyzed = 0;

    for (const m of messages) {
       if (m.model === 'newsler') newslerQueries = m._count._all;
       if (m.model === 'gemini') geminiQueries = m._count._all;
    }

    for (const um of userMessages) {
       if (um.fileNames && um.fileNames.length > 0) filesAnalyzed += um.fileNames.length;
    }

    return NextResponse.json({
       newsler: { queries: newslerQueries, limit: 500, filesAnalyzed },
       gemini: { queries: geminiQueries, limit: 100 }
    });

  } catch (error) {
    console.error('Usage API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}
