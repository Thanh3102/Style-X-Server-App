export type ReportOverviewResponse = {
  netRevenue: number;
  grossProfit: number;
  numberOfOrders: number;
  inventoryValue: number;
};

export type ReportRevenueResponse = {
  grossProfit: number;
  averageOrder: number;
  numberOfOrders: number;
  reports: Array<{
    label: string;
    total: number;
    avg: number;
    count: number;
  }>;
};

export type ReportBestSale = Array<{
  productName: string;
  revenue: number;
  quantity: number;
}>;

export type ReportLowStock = Array<{
  product: {
    id: number;
    name: string;
    vendor: string;
    type: string;
  };
  variant: {
    id: number;
    title: string;
    skuCode: string;
    barCode: string;
  };
  onHand: number;
  warehouses: {
    id: number;
    name: string;
    onHand: number;
  }[];
}>;

export type ReportRevenueDetailResponse = {
  totalNumberOfOrder: number; // Số lượng đơn hàng
  totalNumberOfOrderItem: number; // Số lượng đặt hàng
  totalGoodValue: number; // Tiền hàng
  totalDiscount: number; // Giảm giá
  totalNetRevenue: number; // Doanh thu thuần = Tiền hàng - khuyến mại
  totalGrossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - giá vốn
  totalAverageOrderValue: number; // Giá trị đơn trung bình
  totalCost: number; // Giá vốn
  reports: Array<{
    time: string;
    label: string;
    numberOfOrder: number; // Số lượng đơn hàng
    numberOfOrderItem: number; // Số lượng đặt hàng
    goodValue: number; // Tiền hàng
    discount: number; // Giảm giá
    netRevenue: number; // Doanh thu thuần = Tiền hàng - khuyến mại
    grossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - giá vốn
    averageOrderValue: number; // Giá trị đơn trung bình
    cost: number; // Giá vốn
  }>;
};

export type ReportProductRevenueDetailResponse = Array<{
  product: {
    id: number;
    name: string;
  };
  totalNumberOfOrder: number; // Số lượng đơn hàng
  totalNumberOfItem: number; // Số lượng đặt hàng
  totalGoodValue: number; // Tiền hàng
  totalDiscount: number; // Giảm giá
  totalNetRevenue: number; // Doanh thu thuần = Tiền hàng - khuyến mại
  totalGrossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - giá vốn
  totalAverageOrderValue: number; // Giá trị đơn trung bình
  totalCost: number; // Giá vốn
  reports: Array<{
    time: string;
    numberOfOrder: number; // Số lượng đơn hàng
    numberOfItem: number; // Số lượng đặt hàng
    goodValue: number; // Tiền hàng
    discount: number; // Giảm giá
    netRevenue: number; // Doanh thu thuần = Tiền hàng - khuyến mại
    grossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - giá vốn
    averageOrderValue: number; // Giá trị đơn trung bình
    cost: number; // Giá vốn
  }>;
}>;
