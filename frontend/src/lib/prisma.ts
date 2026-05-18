import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prismaInstance?: PrismaClient };

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (!globalForPrisma.prismaInstance) {
      globalForPrisma.prismaInstance = new PrismaClient({ log: ['error'] });
    }
    return Reflect.get(globalForPrisma.prismaInstance, prop, receiver);
  }
});
