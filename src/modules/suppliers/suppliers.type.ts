export type CreateSupplierDTO = {
  name: string;
  code: string | undefined;
  phoneNumber: string | undefined;
  email: string | undefined;
  taxCode: string | undefined;
  website: string | undefined;
  fax: string | undefined;
  country: string | undefined;
  province: string | undefined;
  district: string | undefined;
  ward: string | undefined;
  detailAddress: string | undefined;
  assignedId: string;
  tags: string[];
};

export type UpdateSupplierDTO = {
  id: number;
  name: string;
  code: string | undefined;
  phoneNumber: string | undefined;
  email: string | undefined;
  taxCode: string | undefined;
  website: string | undefined;
  fax: string | undefined;
  country: string | undefined;
  province: string | undefined;
  district: string | undefined;
  ward: string | undefined;
  detailAddress: string | undefined;
  assignedId: number;
  tags: string[];
  active: boolean;
};

export type CheckCodeOptions = {
  checkExist?: boolean;
  checkPrefix?: boolean;
};

export type GetDataOptions = {
  page?: number | undefined;
  limit?: number | undefined;
  query?: string | undefined;
  createdOn?: string | undefined;
  createdOnMin?: string | undefined;
  createdOnMax?: string | undefined;
};
