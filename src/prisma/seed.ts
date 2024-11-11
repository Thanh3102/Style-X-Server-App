import { PrismaClient } from '@prisma/client';
import { hashPlainText } from 'src/utils/helper/bcryptHelper';
import { accounts } from './seed-data/account';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { warehouses } from './seed-data/warehouse';
import { categories } from './seed-data/category';

const prisma = new PrismaClient();

// async function generateCustomID(
//   prefix: string,
//   table: string,
//   pad: number = 6,
// ) {
//   const lastCustomIdRecord = await prisma[table].findFirst({
//     select: { code: true },
//     where: {
//       code: {
//         startsWith: prefix,
//       },
//     },
//     orderBy: {
//       createdAt: 'desc',
//     },
//   });
//   if (lastCustomIdRecord) {
//     const countString = lastCustomIdRecord.code.slice(prefix.length);
//     const newCount = Number(countString) + 1;
//     return prefix + newCount.toString().padStart(pad, '0');
//   }

//   return prefix + '1'.padStart(pad, '0');
// }

async function createSystemAccount() {
  for (let acc of accounts) {
    const hash = await hashPlainText(acc.password);
    const code = acc.code ?? (await generateCustomID('USER', 'employee'));
    await prisma.employee.create({
      data: {
        code: code,
        username: acc.username,
        password: hash,
        name: acc.name,
        dateOfBirth: new Date(),
        email: '',
        gender: true,
        nationality: '',
        phoneNumber: '',
      },
    });
  }
}

async function createWarehouse() {
  for (let warehouse of warehouses) {
    await prisma.warehouse.create({
      data: {
        code: warehouse.code ?? (await generateCustomID('WH', 'warehouse')),
        name: warehouse.name,
      },
    });
  }
}

async function createCategories() {
  for (let category of categories) {
    await prisma.category.create({
      data: {
        title: category.title,
        slug: category.slug,
      },
    });
  }
}

async function main() {
  // await createSystemAccount();
  // await createWarehouse();
  await createCategories();
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
