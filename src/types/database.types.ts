// src/types/database.types.ts
import { PartnerType, ExpenseType, RevenueType } from '@/constants/hkd-constants';

export interface Partner {
  id: string;
  household_id: string;
  name: string;
  tax_code: string | null;
  partner_type: PartnerType;
  default_expense_type: ExpenseType | null | '';
  bank_account_number: string | null;
  contact_person: string | null;
  legal_representative: string | null;
  address: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PartnerFormRow {
  name: string;
  tax_code: string;
  partner_type: PartnerType;
  default_expense_type: ExpenseType | '';
  bank_account_number: string;
  contact_person: string;
  legal_representative: string;
  address: string;
}

export interface UnitItem {
  id: string;
  household_id: string;
  name: string;
  sort_order: number;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WarehouseItem {
  id: string;
  household_id: string;
  name: string;
  sort_order: number;
  description: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProductCategory = 'Hàng hóa' | 'Dịch vụ' | 'Thành phẩm' | 'Nguyên vật liệu';

export interface ProductItem {
  id: string;
  household_id: string;
  code: string;
  invoice_code: string | null;
  name: string;
  unit_id: string | null;
  unit_name: string | null;
  category: ProductCategory;
  default_revenue_type: RevenueType | null | '';
  is_excise_tax: boolean;
  is_ecommerce: boolean;
  is_aggregated: boolean;
  current_stock: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductFormRow {
  code: string;
  invoice_code: string;
  name: string;
  unit_name: string;
  category: ProductCategory;
  default_revenue_type: RevenueType | '';
  current_stock: number;
  is_excise_tax: boolean;
  is_ecommerce: boolean;
  is_aggregated: boolean;
}

export interface ProductConversionItem {
  id: string;
  household_id: string;
  source_product_id: string;
  source_product_code?: string;
  source_product_name?: string;
  source_quantity: number;
  source_unit_name: string | null;
  target_product_id: string;
  target_product_code?: string;
  target_product_name?: string;
  target_quantity: number;
  target_unit_name: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BankAccountItem {
  id: string;
  household_id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch_name: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}