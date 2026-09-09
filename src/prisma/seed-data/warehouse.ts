type Warehouse = {
  name: string;
  code?: string;
  phoneNumber?: string;
  email?: string;
  country?: string;
  province?: string;
  district?: string;
  ward?: string;
  address?: string;
};
export const warehouses: Warehouse[] = [
  {
    name: 'Cửa hàng chính',
  },
  {
    name: 'Chi nhánh A',
  },
  {
    name: 'Chi nhánh B',
  },
];
