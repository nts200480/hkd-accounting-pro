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

export interface ProductItem {
  id: string;
  household_id: string;
  code: string;
  invoice_code: string | null;
  name: string;
  unit_id: string | null;
  unit_name: string | null;
  category: 'Hàng hóa' | 'Dịch vụ' | 'Thành phẩm' | 'Nguyên vật liệu';
  default_revenue_type: RevenueType | null;
  is_excise_tax: boolean;
  is_ecommerce: boolean;
  is_aggregated: boolean;
  current_stock: number;
  created_at?: string;
  updated_at?: string;
}