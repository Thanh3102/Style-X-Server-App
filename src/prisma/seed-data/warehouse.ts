type Warehouse = {
  name: string;
  code?: string;
  phoneNumber?: string;
  email?: String;
  country?: String;
  province?: String;
  district?: String;
  ward?: String;
  address?: String;
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
