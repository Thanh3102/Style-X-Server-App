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
}

export class UpdateVariantDTO {
  variantId: number;
  barCode: string | undefined;
  comparePrice: number | undefined;
  costPrice: number | undefined;
  sellPrice: number | undefined;
  skuCode: string | undefined;
  unit: string | undefined;
}
