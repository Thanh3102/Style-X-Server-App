type Product = {
  name: string;
  costPrice: number;
  sellPrice: number;
  unit: string;
  vendor: string;
  quantity: number;
  categoryId: number;
};

const generateRandomPrice = (min: number, max: number) => {
  const price =
    Math.round((Math.floor(Math.random() * (max - min + 1)) + min) / 1000) *
    1000;
  return price;
};

const generateRandomQuantity = () => {
  return Math.floor(Math.random() * 100) + 1;
};

const generateRandomVendor = () => {
  const vendors = [
    'Nike',
    'Adidas',
    'Puma',
    'Zara',
    'H&M',
    'Uniqlo',
    'Mango',
    'Gucci',
  ];
  return vendors[Math.floor(Math.random() * vendors.length)];
};

export const generateProduct = (
  categoryId: number,
  categoryName: string,
): Product => {

  const price = generateRandomPrice(30000, 6e6)

  const name = `${categoryName} - ${Math.random().toString(36).substring(10)}`;
  const costPrice = price;
  const sellPrice = price * 1.2
  const unit = 'Cái';
  const vendor = generateRandomVendor();
  const quantity = generateRandomQuantity();

  return {
    name,
    costPrice,
    sellPrice,
    unit,
    vendor,
    quantity,
    categoryId,
  };
};
