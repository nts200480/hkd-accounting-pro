// src/app/(hkd)/inventory/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ProductItem,
  UnitItem,
  WarehouseItem,
  ProductConversionItem,
} from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ProductsMasterTab } from './_components/ProductsMasterTab';
import { UnitsTab } from './_components/UnitsTab';
import { ProductConversionsTab } from './_components/ProductConversionsTab';
import { WarehousesTab } from './_components/WarehousesTab';

export type InventorySubTabKey =
  | 'summary'
  | 'vouchers'
  | 'history'
  | 'products'
  | 'units'
  | 'conversions'
  | 'bom'
  | 'warehouses';

const INVENTORY_SUB_TABS: Array<{ key: InventorySubTabKey; label: string }> = [
  { key: 'summary', label: 'Tổng hợp nhập xuất tồn' },
  { key: 'vouchers', label: 'Phiếu nhập / xuất kho' },
  { key: 'history', label: 'Lịch sử nhập / xuất kho' },
  { key: 'products', label: 'Hàng hóa / dịch vụ' },
  { key: 'units', label: 'Đơn vị hàng hóa' },
  { key: 'conversions', label: 'Quy đổi hàng hóa tự động' },
  { key: 'bom', label: 'Định mức sản phẩm (BOM)' },
  { key: 'warehouses', label: 'Nhà kho' },
];

const INITIAL_UNITS: UnitItem[] = [
  {
    id: 'u-1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'kg',
    sort_order: 0,
    description: '',
    created_at: '13/07/2026 11:54',
    updated_at: '13/07/2026 11:54',
  },
];

const INITIAL_WAREHOUSES: WarehouseItem[] = [
  {
    id: 'w-1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Nhà kho',
    sort_order: 0,
    description: '',
    is_default: true,
    created_at: '18/04/2026 16:12',
    updated_at: '13/07/2026 11:55',
  },
];

const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'pr-1',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: '21A5-746ITL',
    invoice_code: null,
    name: 'Đã giảm 164.574,2 đồng tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15',
    unit_id: null,
    unit_name: null,
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 0,
  },
  {
    id: 'pr-2',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: '21A5-MIE58S',
    invoice_code: null,
    name: 'Đã giảm 158.070 đồng tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15',
    unit_id: null,
    unit_name: null,
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 0,
  },
  {
    id: 'pr-3',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: '21A5-Z5PGV8',
    invoice_code: null,
    name: 'Đã giảm 207.000 đồng tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15',
    unit_id: null,
    unit_name: null,
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 0,
  },
  {
    id: 'pr-4',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: '21A5-IQTQ5X',
    invoice_code: null,
    name: 'Đã giảm 214.830 đồng tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15',
    unit_id: null,
    unit_name: null,
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 0,
  },
  {
    id: 'pr-5',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: 'PET',
    invoice_code: null,
    name: 'Nhựa phế liệu PET',
    unit_id: 'u-1',
    unit_name: 'kg',
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 35804.5,
  },
  {
    id: 'pr-6',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: '21A5-D3JCIC',
    invoice_code: null,
    name: 'Đã giảm 205.400 đồng tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15',
    unit_id: null,
    unit_name: null,
    category: 'Hàng hóa',
    default_revenue_type: 'Không chịu thuế',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 0,
  },
  {
    id: 'pr-7',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: 'HDPE',
    invoice_code: null,
    name: 'Nhựa phế liệu HDPE',
    unit_id: 'u-1',
    unit_name: 'kg',
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: 9613.1,
  },
  {
    id: 'pr-8',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: 'PVC',
    invoice_code: null,
    name: 'Nhựa phế liệu PVC',
    unit_id: 'u-1',
    unit_name: 'kg',
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: -9950.8,
  },
  {
    id: 'pr-9',
    household_id: '00000000-0000-0000-0000-000000000001',
    code: 'PP',
    invoice_code: null,
    name: 'Nhựa phế liệu PP',
    unit_id: 'u-1',
    unit_name: 'kg',
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
    current_stock: -9796.5,
  },
];

export default function InventoryPage() {
  const { household } = useHkd();
  // Mở mặc định tab 'products' (Hàng hóa / dịch vụ) để bạn test ngay Giai đoạn 1.3
  const [activeTab, setActiveTab] = useState<InventorySubTabKey>('products');

  const [units, setUnits] = useState<UnitItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [conversions, setConversions] = useState<ProductConversionItem[]>([]);
  const [conversionSourceProduct, setConversionSourceProduct] =
    useState<ProductItem | null>(null);

  const fetchInventoryMasterData = useCallback(async () => {
    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const [uRes, wRes, pRes, cRes] = await Promise.all([
        supabase
          .from('units')
          .select('*')
          .eq('household_id', household.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('warehouses')
          .select('*')
          .eq('household_id', household.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('product_conversions')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
      ]);

      setUnits(uRes.data && uRes.data.length > 0 ? (uRes.data as UnitItem[]) : INITIAL_UNITS);
      setWarehouses(
        wRes.data && wRes.data.length > 0 ? (wRes.data as WarehouseItem[]) : INITIAL_WAREHOUSES
      );
      setProducts(
        pRes.data && pRes.data.length > 0 ? (pRes.data as ProductItem[]) : INITIAL_PRODUCTS
      );
      setConversions((cRes.data as ProductConversionItem[]) || []);
    } else {
      setUnits(INITIAL_UNITS);
      setWarehouses(INITIAL_WAREHOUSES);
      setProducts(INITIAL_PRODUCTS);
    }
  }, [household.id]);

  useEffect(() => {
    fetchInventoryMasterData();
  }, [fetchInventoryMasterData]);

  return (
    <div className="space-y-3">
      {/* Thanh 8 Tab con của Sổ kho (S2d) */}
      <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs flex flex-wrap items-center gap-1.5">
        {INVENTORY_SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setConversionSourceProduct(null);
                setActiveTab(tab.key);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition ${
                isActive
                  ? 'bg-[#1565c0] text-white border-[#1565c0] font-semibold'
                  : 'bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Nội dung từng Tab con */}
      {activeTab === 'products' && (
        <ProductsMasterTab
          products={products}
          setProducts={setProducts}
          units={units}
          onSwitchToConversionsTab={(prod) => {
            setConversionSourceProduct(prod || null);
            setActiveTab('conversions');
          }}
        />
      )}

      {activeTab === 'units' && <UnitsTab units={units} setUnits={setUnits} />}

      {activeTab === 'conversions' && (
        <ProductConversionsTab
          conversions={conversions}
          setConversions={setConversions}
          products={products}
          initialSourceProduct={conversionSourceProduct}
        />
      )}

      {activeTab === 'warehouses' && (
        <WarehousesTab warehouses={warehouses} setWarehouses={setWarehouses} />
      )}

      {(activeTab === 'summary' ||
        activeTab === 'vouchers' ||
        activeTab === 'history' ||
        activeTab === 'bom') && (
        <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
          Tab <strong>{INVENTORY_SUB_TABS.find((t) => t.key === activeTab)?.label}</strong>{' '}
          sẽ được triển khai chi tiết trong <strong>Giai đoạn 2 (Prompt 2.1 & 2.2)</strong>{' '}
          dựa trên danh mục Hàng hóa, Đơn vị, Quy đổi và Nhà kho vừa thiết lập ở đây.
        </div>
      )}
    </div>
  );
}