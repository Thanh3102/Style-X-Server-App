export class CreateDiscountDTO {
  type: string;
  mode: string;
  title: string;
  value: number;
  valueLimitAmount: number | null;
  valueType: string;
  entitle: string;
  prerequisite: string;
  prerequisiteCustomerGroupIds: number[];
  prerequisiteMinTotal: number | null;
  prerequisiteMinItem: number | null;
  prerequisiteMinItemTotal: number | null;
  usageLimit: number | null;
  onePerCustomer: boolean;
  combinesWithProductDiscount: boolean;
  combinesWithOrderDiscount: boolean;
  startOn: Date;
  endOn: Date | null;
  active: boolean;
  summary: string;
  entitledProductIds: number[];
  entitledVariantIds: number[];
  entitledCategoriesIds: number[];
  applyFor: string;
}

export class UpdateDiscountDTO {
  id: number;
  title: string;
  value: number;
  valueLimitAmount: number | null;
  valueType: string;
  prerequisite: string;
  prerequisiteCustomerGroupIds: number[];
  prerequisiteMinTotal: number | null;
  prerequisiteMinItem: number | null;
  prerequisiteMinItemTotal: number | null;
  usageLimit: number | null;
  onePerCustomer: boolean;
  combinesWithProductDiscount: boolean;
  combinesWithOrderDiscount: boolean;
  startOn: Date;
  endOn: Date | null;
  summary: string;
  entitle: string;
  entitledProductIds: number[];
  entitledVariantIds: number[];
  entitledCategoriesIds: number[];
  applyFor: string;
}
