// src/constants/hkd-constants.ts

export const PARTNER_TYPES = [
  'Khách hàng',
  'Nhà cung cấp',
  'Khách hàng & NCC',
] as const;

export type PartnerType = (typeof PARTNER_TYPES)[number];

export const REVENUE_TYPES = [
  '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
  '(GTGT: 5%; TNCN: 2%) Dịch vụ, xây dựng không bao thầu nguyên vật liệu',
  '(GTGT: 5%; TNCN: 5%) Hoạt động cho thuê tài sản trừ bất động sản',
  '(GTGT: 3%; TNCN: 1,5%) SX, vận tải, dịch vụ có gắn với hàng hóa, XD có bao thầu nguyên vật liệu',
  '(GTGT: 5%; TNCN: 5%) Hoạt động cung cấp sản phẩm nội thông tin số về giải trí, trò chơi điện tử, phim số, ảnh số, nhạc số, quảng cáo số',
  '(GTGT: 2%; TNCN: 1%) Hoạt động kinh doanh khác',
  'Khác',
  'Không chịu thuế',
] as const;

export type RevenueType = (typeof REVENUE_TYPES)[number];

export interface TaxRateInfo {
  label: RevenueType;
  shortHeader: string;
  vatRate: number; // %
  pitRate: number; // %
  columnKey: string;
}

export const REVENUE_TAX_RATES: Record<RevenueType, TaxRateInfo> = {
  '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa': {
    label: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    shortHeader: 'Phân phối, cung cấp hàng hóa (GTGT: 1%; TNCN: 0,5%)',
    vatRate: 1.0,
    pitRate: 0.5,
    columnKey: 'rev_distribution',
  },
  '(GTGT: 5%; TNCN: 2%) Dịch vụ, xây dựng không bao thầu nguyên vật liệu': {
    label: '(GTGT: 5%; TNCN: 2%) Dịch vụ, xây dựng không bao thầu nguyên vật liệu',
    shortHeader: 'Dịch vụ, xây dựng không bao thầu nguyên vật liệu (GTGT: 5%; TNCN: 2%)',
    vatRate: 5.0,
    pitRate: 2.0,
    columnKey: 'rev_service',
  },
  '(GTGT: 5%; TNCN: 5%) Hoạt động cho thuê tài sản trừ bất động sản': {
    label: '(GTGT: 5%; TNCN: 5%) Hoạt động cho thuê tài sản trừ bất động sản',
    shortHeader: 'Hoạt động cho thuê tài sản (GTGT: 5%; TNCN: 5%)',
    vatRate: 5.0,
    pitRate: 5.0,
    columnKey: 'rev_asset_lease',
  },
  '(GTGT: 3%; TNCN: 1,5%) SX, vận tải, dịch vụ có gắn với hàng hóa, XD có bao thầu nguyên vật liệu': {
    label: '(GTGT: 3%; TNCN: 1,5%) SX, vận tải, dịch vụ có gắn với hàng hóa, XD có bao thầu nguyên vật liệu',
    shortHeader: 'SX, vận tải, dịch vụ gắn với HH, XD có bao thầu NVL (GTGT: 3%; TNCN: 1,5%)',
    vatRate: 3.0,
    pitRate: 1.5,
    columnKey: 'rev_manufacturing',
  },
  '(GTGT: 5%; TNCN: 5%) Hoạt động cung cấp sản phẩm nội thông tin số về giải trí, trò chơi điện tử, phim số, ảnh số, nhạc số, quảng cáo số': {
    label: '(GTGT: 5%; TNCN: 5%) Hoạt động cung cấp sản phẩm nội thông tin số về giải trí, trò chơi điện tử, phim số, ảnh số, nhạc số, quảng cáo số',
    shortHeader: 'Cung cấp sản phẩm nội dung thông tin số (GTGT: 5%; TNCN: 5%)',
    vatRate: 5.0,
    pitRate: 5.0,
    columnKey: 'rev_digital_content',
  },
  '(GTGT: 2%; TNCN: 1%) Hoạt động kinh doanh khác': {
    label: '(GTGT: 2%; TNCN: 1%) Hoạt động kinh doanh khác',
    shortHeader: 'Hoạt động kinh doanh khác (GTGT: 2%; TNCN: 1%)',
    vatRate: 2.0,
    pitRate: 1.0,
    columnKey: 'rev_other_business',
  },
  'Khác': {
    label: 'Khác',
    shortHeader: 'Khác (0%)',
    vatRate: 0,
    pitRate: 0,
    columnKey: 'rev_other',
  },
  'Không chịu thuế': {
    label: 'Không chịu thuế',
    shortHeader: 'Không chịu thuế',
    vatRate: 0,
    pitRate: 0,
    columnKey: 'rev_non_taxable',
  },
};

export const EXPENSE_TYPES = [
  'Chi phí nguyên liệu, nhiên liệu, hàng hóa',
  'Chi phí tiền lương, tiền công bao gồm bảo hiểm xã hội',
  'Chi phí khấu hao tài sản cố định',
  'Chi phí dịch vụ phí điện, nước mua ngoài',
  'Chi phí lãi vay',
  'Các khoản chi phí khác',
  'Chi phí không được trừ',
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export interface HkdNavTab {
  key: string;
  label: string;
  href: string;
  iconName:
    | 'LayoutGrid'
    | 'Handshake'
    | 'TrendingUp'
    | 'Coins'
    | 'Scale'
    | 'Warehouse'
    | 'Wallet'
    | 'FileSpreadsheet'
    | 'Building2';
}

export const HKD_NAV_TABS: HkdNavTab[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', iconName: 'LayoutGrid' },
  { key: 'partners', label: 'Quản lý đối tác', href: '/partners', iconName: 'Handshake' },
  { key: 'revenues', label: 'Sổ doanh thu (S2a/S2b)', href: '/revenues', iconName: 'TrendingUp' },
  {
    key: 'expenses',
    label: 'Sổ chi phí sản xuất, kinh doanh (S2c)',
    href: '/expenses',
    iconName: 'Coins',
  },
  {
    key: 'other-taxes',
    label: 'Sổ theo dõi nghĩa vụ thuế khác (S3a)',
    href: '/other-taxes',
    iconName: 'Scale',
  },
  { key: 'inventory', label: 'Sổ kho (S2d)', href: '/inventory', iconName: 'Warehouse' },
  {
    key: 'cash-book',
    label: 'Sổ chi tiết tiền (S2e-HKD)',
    href: '/cash-book',
    iconName: 'Wallet',
  },
  { key: 'debts', label: 'Sổ công nợ', href: '/debts', iconName: 'FileSpreadsheet' },
  {
    key: 'fixed-assets',
    label: 'Sổ tài sản cố định hữu hình',
    href: '/fixed-assets',
    iconName: 'Building2',
  },
];

export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '0';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(amount));
}