import { ProductService } from './product.service';

export type Warehouse = {
  id: number;
  name: string;
  onHand: number;
};

export type Option = {
  name: string;
  position: string;
  values: string[];
};

export type Variant = {
  title: string;
  option1: string;
  option2: string;
  option3: string;
  skuCode: string;
  barCode: string;
  unit: string;
  sellPrice: number;
  costPrice: number;
  comparePrice: number;
  warehouses: Warehouse[];
};

export type CreateProductDTO = {
  name: string;
  skuCode: string;
  barCode: string;
  unit: string;
  description: string;
  shortDescription: string;
  sellPrice: number;
  costPrice: number;
  comparePrice: number;
  avaiable: boolean;
  warehouses: Warehouse[];
  vendor: string;
  type: string;
  options: Option[];
  variants: Variant[];
  tags: string[];
  categoryIds: number[];
  images: Array<Express.Multer.File>;
};

export type CreateCategoryDTO = {
  title: string;
  slug: string;
  image: Express.Multer.File | undefined | null;
  collectionId: string;
};

export type UpdateCategoryDTO = {
  id: string;
  title: string;
  slug: string;
  image: Express.Multer.File | undefined | null;
  collectionId: string;
};

export type CreateCollectionDTO = {
  title: string;
  slug: string;
};

export type UpdateCollectionDTO = {
  id: string;
  title: string;
  slug: string;
};

export type UpdateMainImageDTO = {
  image: string;
};

export type UpdateProductDTO = {
  id: number;
  avaiable: boolean;
  addTags: string[];
  deleteTags: string[];
  addCategoryIds: number[];
  deleteCategoryIds: number[];
  name: string;
  description: string | undefined;
  shortDescription: undefined;
  type: string | undefined;
  vendor: string | undefined;
  sellPrice: number;
  costPrice: number;
  comparePrice: number;
  deleteVariantIds: number[];
  options: Array<{
    id: number;
    name: string;
    position: number;
    values: string[];
  }>;
  newVariants: Array<{
    barCode: undefined | string;
    comparePrice: number;
    costPrice: number;
    option1: string;
    option2: string;
    option3: string;
    sellPrice: number;
    skuCode: string;
    title: string;
    unit: string | undefined;
  }>;
};

export type UpdateVariantDTO = {
  variantId: number;
  barCode: string | undefined;
  comparePrice: number | undefined;
  costPrice: number | undefined;
  sellPrice: number | undefined;
  skuCode: string | undefined;
  unit: string | undefined;
};

export type PublicProductParams = {
  page?: string;
  limit?: string;
  query?: string;
  category?: string;
  slug?: string;
  sort?: string;
  priceRange?: string;
};

export type ProductPublic = Awaited<
  ReturnType<typeof ProductService.prototype.getProductPublic>
>[number];

export type ProductDetailPublic = Awaited<
  ReturnType<typeof ProductService.prototype.getProductDetailPublic>
>;

export type ProductPublicVariant = Awaited<
  ReturnType<typeof ProductService.prototype.getProductPublicVariants>
>[number];
