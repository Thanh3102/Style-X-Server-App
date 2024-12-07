type Category = {
  title: string;
  slug: string;
};

type Collection = {
  title: string;
  slug: string;
  position: number;
  categories: Category[];
};

export const collections: Collection[] = [
  {
    title: 'Nam',
    slug: 'nam',
    position: 1,
    categories: [
      { title: 'Áo thun', slug: 'ao-thun' },
      { title: 'Quần jean', slug: 'quan-jean' },
      { title: 'Áo sơ mi', slug: 'ao-so-mi' },
      { title: 'Giày thể thao', slug: 'giay-the-thao' },
      { title: 'Áo khoác', slug: 'ao-khoac' },
    ],
  },
  {
    title: 'Nữ',
    slug: 'nu',
    position: 2,
    categories: [
      { title: 'Váy', slug: 'vay' },
      { title: 'Áo sơ mi', slug: 'ao-so-mi' },
      { title: 'Quần legging', slug: 'quan-legging' },
      { title: 'Giày cao gót', slug: 'giay-cao-got' },
      { title: 'Áo khoác', slug: 'ao-khoac' },
    ],
  },
  {
    title: 'Trẻ em',
    slug: 'tre-em',
    position: 3,
    categories: [
      { title: 'Áo thun', slug: 'ao-thun' },
      { title: 'Quần jean', slug: 'quan-jean' },
      { title: 'Váy trẻ em', slug: 'vay-tre-em' },
      { title: 'Giày dép trẻ em', slug: 'giay-dep-tre-em' },
      { title: 'Mũ', slug: 'mu' },
    ],
  },
  {
    title: 'Phụ kiện',
    slug: 'phu-kien',
    position: 4,
    categories: [
      { title: 'Túi sách', slug: 'tui-sach' },
      { title: 'Mỹ phẩm', slug: 'my-pham' },
      { title: 'Mũ', slug: 'mũ' },
      { title: 'Ba lô', slug: 'balo' },
    ],
  },
];
