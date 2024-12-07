import { DiscountService } from './discount.service';

export type CreateDiscountDTO = {
  type: string;
  mode: string;
  title: string;
  description: string;
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
};

export type UpdateDiscountDTO = {
  id: number;
  title: string;
  description: string;
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
};

export type ActiveDiscount = Awaited<
  ReturnType<typeof DiscountService.prototype.getActiveDiscounts>
>[number];
