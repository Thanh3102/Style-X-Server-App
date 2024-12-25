import { PrismaClient } from '@prisma/client';
import { hashPlainText } from 'src/utils/helper/bcryptHelper';
import { accounts } from './seed-data/account';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { warehouses } from './seed-data/warehouse';
import { collections } from './seed-data/collections';
import { generateProduct } from './seed-data/product';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';
import { permissionSections } from './seed-data/permission';

const prisma = new PrismaClient();

async function createPermission() {
  for (const section of permissionSections) {
    await prisma.permissionSection.create({
      data: {
        name: section.section,
        permissions: {
          createMany: {
            data: section.permissions,
          },
        },
      },
    });
  }
}

async function createAdminRole() {
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
    },
  });

  await prisma.role.create({
    data: {
      name: 'Admin',
      isEditable: false,
      isDeletable: false,
      rolePermissions: {
        createMany: {
          data: permissions.map((perm) => ({
            permissionId: perm.id,
          })),
        },
      },
    },
  });
}

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
        // nationality: '',
        phoneNumber: '',
        roleId: 1,
      },
    });
  }
}

async function createWarehouse() {
  const code = await generateCustomID('WH', 'warehouse');
  await prisma.warehouse.create({
    data: {
      code: code,
      name: 'Kho khởi tạo',
      address: '',
      district: '',
      email: '',
      phoneNumber: '',
      province: '',
      ward: '',
    },
  });
}

async function createCollections() {
  for (let collection of collections) {
    await prisma.collection.create({
      data: {
        title: collection.title,
        slug: collection.slug,
        position: collection.position,
        categories: {
          createMany: {
            data: collection.categories,
          },
        },
      },
    });
  }
}

async function createProducts() {
  const categories = await prisma.category.findMany();

  for (let category of categories) {
    for (let i = 0; i < 10; i++) {
      const skuCode = await generateCustomID('SKU', 'product', 'skuCode');
      const product = generateProduct(category.id, category.title);
      const createdProduct = await prisma.product.create({
        data: {
          avaiable: true,
          name: product.name,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          comparePrice: product.sellPrice,
          skuCode: skuCode,
          unit: product.unit,
          vendor: product.vendor,
          productCategories: {
            create: {
              categoryId: category.id,
            },
          },
        },
      });

      const defaultVariant = await prisma.productVariants.create({
        data: {
          title: 'Default Title',
          skuCode: skuCode,
          comparePrice: product.costPrice,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          unit: product.unit,
          productId: createdProduct.id,
        },
        select: {
          id: true,
        },
      });

      await prisma.inventory.create({
        data: {
          variant_id: defaultVariant.id,
          warehouse_id: 1,
          avaiable: product.quantity,
          onHand: product.quantity,
          histories: {
            create: {
              avaiableQuantityChange: product.quantity,
              newAvaiable: product.quantity,
              onHandQuantityChange: product.quantity,
              newOnHand: product.quantity,
              transactionType: InventoryTransactionType.PRODUCT,
              transactionAction: InventoryTransactionAction.INITIAL_SETUP,
              changeUserId: 1,
            },
          },
        },
      });
    }
  }
}

async function main() {
  await createPermission();
  await createAdminRole();
  await createSystemAccount();
  await createWarehouse();
  await createCollections();
  await createProducts();
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
