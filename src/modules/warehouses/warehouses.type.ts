export type CreateWarehouseDto = {
  name: string;
  email: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  address: string;
};

export type UpdateWarehouseDto = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  address: string;
  active: boolean;
};
