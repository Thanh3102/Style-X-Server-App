import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateCustomID(
  prefix: string,
  table: string,
  pad: number = 6,
) {
  const lastCustomIdRecord = await prisma[table].findFirst({
    select: { code: true },
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (lastCustomIdRecord) {
    const countString = lastCustomIdRecord.code.slice(prefix.length);
    const newCount = Number(countString) + 1;
    return prefix + newCount.toString().padStart(pad, '0');
  }

  return prefix + '1'.padStart(pad, '0');
}
