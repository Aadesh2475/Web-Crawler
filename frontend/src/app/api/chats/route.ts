import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';


export async function GET() {
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ chats: [] });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ chats: [] });

  const chats = await prisma.chat.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  return NextResponse.json({ chats });
}

// POST /api/chats — create or update a chat
export async function POST(req: NextRequest) {
  const { chatId, title, model, messages } = await req.json();
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();

  // Upsert user if logged in
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
      update: {
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
        updatedAt: new Date(),
      },
    });
    userId = user.id;
  }

  // Upsert chat
  const chat = await prisma.chat.upsert({
    where: { id: chatId ?? '__new__' },
    create: { title: title ?? 'New Chat', model: model ?? 'newsler', userId },
    update: { title, model, updatedAt: new Date() },
  });

  // Save new messages
  if (messages?.length) {
    for (const m of messages) {
      await prisma.message.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          chatId: chat.id,
          role: m.role,
          content: m.content,
          model: m.model,
          fileNames: m.fileNames ?? [],
        },
        update: {},
      });
    }
  }

  return NextResponse.json({ chatId: chat.id });
}

// DELETE /api/chats?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { getServerSession } = await import('next-auth');
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.chat.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
