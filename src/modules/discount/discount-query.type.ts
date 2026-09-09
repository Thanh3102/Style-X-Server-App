import { Discount, Prisma, Product, ProductVariants } from '@prisma/client';

export type ActiveDiscountOptions = {
  mode: Array<'coupon' | 'promotion'>;
  type: Array<'product' | 'order'>;
};

export type ActiveDiscountResult = Discount & {
  productIds: number[];
  variantIds: number[];
  categoryIds: number[];
};

export type EntitledProduct = Pick<Product, 'id' | 'name' | 'image'>;
export type EntitledVariant = Pick<
  ProductVariants,
  'id' | 'title' | 'image' | 'productId'
>;
export type EntitledCategory = Prisma.CategoryGetPayload<{
  select: { id: true; title: true; collection: true };
}>;

export type DiscountDetail = Prisma.DiscountGetPayload<{
  include: { createdUser: { select: { name: true } } };
}> & {
  products: EntitledProduct[];
  variants: EntitledVariant[];
  categories: EntitledCategory[];
};

export type DiscountListQuery = {
  whereConditon: Prisma.DiscountWhereInput;
  page: number;
  limit: number;
  skip: number;
};

export type DiscountListItem = Pick<
  Discount,
  | 'id'
  | 'mode'
  | 'active'
  | 'description'
  | 'startOn'
  | 'endOn'
  | 'createdAt'
  | 'usage'
  | 'usageLimit'
  | 'combinesWithOrderDiscount'
  | 'combinesWithProductDiscount'
  | 'summary'
  | 'title'
  | 'type'
  | 'void'
>;

export type DiscountListResult = {
  discounts: DiscountListItem[];
  paginition: {
    total: number;
    count: number;
    page: number;
    limit: number;
  };
};

export type VoucherResult = Discount & {
  entitleCategories: number[];
  entitleProducts: number[];
  entitleVariants: number[];
};
