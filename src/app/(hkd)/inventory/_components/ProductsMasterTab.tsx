// src/app/(hkd)/inventory/_components/ProductsMasterTab.tsx
'use client';

import React, { useState } from 'react';
import {
  Plus,
  FileDown,
  Trash2,
  PlaySquare,
  SquarePen,
  X,
  CheckCircle2,
  GitMerge,
  ArrowLeftRight,
  List,
  Pencil,
} from 'lucide-react';
import {
  REVENUE_TYPES,
  RevenueType,
  formatVND,
} from '@/constants/hkd-constants';
import {
  ProductItem,
  ProductFormRow,
  ProductCategory,
  UnitItem,
} from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';
import {
  MultiRowModal,
  ModalFieldColumn,
  BulkActionConfig,
} from '@/components/shared/MultiRowModal';
import {
  PRODUCT_EXCEL_TEMPLATE_CONFIG,
  PRODUCT_CATEGORIES,
} from '@/lib/excel/excel-templates';
import { exportProductsToExcel } from '@/lib/excel/tt88-exporter';

interface ProductsMasterTabProps {
  products: ProductItem[];
  setProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  units: UnitItem[];
  onSwitchToConversionsTab?: (sourceProduct?: ProductItem) => void;
}

export function ProductsMasterTab({
  products,
  setProducts,
  units,
  onSwitchToConversionsTab,
}: ProductsMasterTabProps) {
  const { household } = useHkd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Popup Thêm nhiều hàng hóa
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Popup Sửa 1 hàng hóa
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Popup Gộp hàng hóa / dịch vụ
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  // Popup Chỉnh sửa hàng loạt
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkUnitName, setBulkUnitName] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkRevenueType, setBulkRevenueType] = useState<string>('');

  const unitNameOptions = units.length > 0 ? units.map((u) => u.name) : ['kg', 'cái', 'thùng'];

  // Mở Popup Gộp hàng hóa
  const handleOpenMergeModal = () => {
    if (selectedIds.length >= 2) {
      setMergeSourceIds(selectedIds);
      setMergeTargetId(selectedIds[0]);
    } else {
      setMergeSourceIds([]);
      setMergeTargetId(products[0]?.id || '');
    }
    setIsMergeModalOpen(true);
  };

  // Thực thi Gộp hàng hóa trùng về 1 mã chuẩn và tự động cập nhật các phiếu liên quan
  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeTargetId) {
      alert('Vui lòng chọn 1 Mã hàng chuẩn (đích) để giữ lại.');
      return;
    }
    const duplicateIds = mergeSourceIds.filter((id) => id !== mergeTargetId);
    if (duplicateIds.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 mã hàng bị trùng cần gộp vào mã chuẩn.');
      return;
    }

    const targetProduct = products.find((p) => p.id === mergeTargetId);
    if (!targetProduct) return;

    const duplicateProducts = products.filter((p) => duplicateIds.includes(p.id));
    const addedStock = duplicateProducts.reduce(
      (sum, item) => sum + Number(item.current_stock || 0),
      0
    );
    const newTotalStock = Number(targetProduct.current_stock || 0) + addedStock;

    if (
      !window.confirm(
        `Gộp ${duplicateProducts.length} mã hàng (${duplicateProducts
          .map((d) => d.code)
          .join(', ')}) vào mã chuẩn "${targetProduct.code} - ${
          targetProduct.name
        }"?\nToàn bộ phiếu nhập/xuất, doanh thu, chi phí liên quan sẽ được chuyển sang mã "${
          targetProduct.code
        }".`
      )
    ) {
      return;
    }

    setIsMerging(true);
    try {
      const supabase = createClient();
      if (supabase && isSupabaseConfigured) {
        // 1. Cập nhật chi tiết phiếu nhập/xuất kho (inventory_items)
        await supabase
          .from('inventory_items')
          .update({
            product_id: targetProduct.id,
            product_code: targetProduct.code,
            product_name: targetProduct.name,
            unit_name: targetProduct.unit_name,
          })
          .in('product_id', duplicateIds)
          .eq('household_id', household.id);

        // 2. Cập nhật Sổ doanh thu (revenues)
        await supabase
          .from('revenues')
          .update({
            product_id: targetProduct.id,
            product_name: targetProduct.name,
          })
          .in('product_id', duplicateIds)
          .eq('household_id', household.id);

        // 3. Cập nhật Sổ chi phí (expenses)
        await supabase
          .from('expenses')
          .update({
            product_id: targetProduct.id,
            product_name: targetProduct.name,
          })
          .in('product_id', duplicateIds)
          .eq('household_id', household.id);

        // 4. Cập nhật Số dư đầu kỳ (opening_balances)
        await supabase
          .from('opening_balances')
          .update({ product_id: targetProduct.id })
          .in('product_id', duplicateIds)
          .eq('household_id', household.id);

        // 5. Cập nhật Quy đổi hàng hóa tự động (product_conversions)
        await supabase
          .from('product_conversions')
          .update({ source_product_id: targetProduct.id })
          .in('source_product_id', duplicateIds)
          .eq('household_id', household.id);

        await supabase
          .from('product_conversions')
          .update({ target_product_id: targetProduct.id })
          .in('target_product_id', duplicateIds)
          .eq('household_id', household.id);

        // 6. Cập nhật số lượng tồn cộng dồn cho mã hàng chuẩn
        await supabase
          .from('products')
          .update({ current_stock: newTotalStock })
          .eq('id', targetProduct.id)
          .eq('household_id', household.id);

        // 7. Xóa các mã hàng bị trùng
        const { error: delError } = await supabase
          .from('products')
          .delete()
          .in('id', duplicateIds)
          .eq('household_id', household.id);

        if (delError) throw delError;
      }

      // Cập nhật State giao diện
      setProducts((prev) =>
        prev
          .filter((p) => !duplicateIds.includes(p.id))
          .map((p) =>
            p.id === targetProduct.id ? { ...p, current_stock: newTotalStock } : p
          )
      );
      setSelectedIds([]);
      setIsMergeModalOpen(false);
    } catch (err: any) {
      alert(`Lỗi khi gộp hàng hóa: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Xử lý Thêm nhiều hàng hóa / dịch vụ
  const handleAddMultipleProducts = async (rows: ProductFormRow[]) => {
    const validRows = rows.filter((r) => r.code.trim() !== '' && r.name.trim() !== '');
    if (validRows.length === 0) return;

    const payload = validRows.map((r) => {
      const matchedUnit = units.find(
        (u) => u.name.toLowerCase() === String(r.unit_name || '').trim().toLowerCase()
      );
      return {
        household_id: household.id,
        code: r.code.trim(),
        invoice_code: r.invoice_code?.trim() || null,
        name: r.name.trim(),
        unit_id: matchedUnit?.id || null,
        unit_name: r.unit_name?.trim() || matchedUnit?.name || null,
        category: (PRODUCT_CATEGORIES.includes(r.category as any)
          ? r.category
          : 'Hàng hóa') as ProductCategory,
        default_revenue_type:
          r.default_revenue_type &&
          REVENUE_TYPES.includes(r.default_revenue_type as RevenueType)
            ? (r.default_revenue_type as RevenueType)
            : '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
        current_stock: Number(r.current_stock || 0),
        is_excise_tax: Boolean(r.is_excise_tax),
        is_ecommerce: Boolean(r.is_ecommerce),
        is_aggregated: r.is_aggregated !== undefined ? Boolean(r.is_aggregated) : true,
      };
    });

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('*');
      if (error) {
        throw new Error(`Không thể lưu hàng hóa vào Supabase: ${error.message}`);
      }
      if (data) {
        setProducts((prev) => [...(data as ProductItem[]), ...prev]);
      }
    } else {
      const localInserted: ProductItem[] = payload.map((item, idx) => ({
        ...item,
        id: `prod-${Date.now()}-${idx}`,
      }));
      setProducts((prev) => [...localInserted, ...prev]);
    }
  };

  // Xử lý Cập nhật 1 hàng hóa
  const handleUpdateSingleProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.code.trim() || !editingProduct.name.trim()) return;

    const matchedUnit = units.find((u) => u.name === editingProduct.unit_name);
    const updatedFields = {
      code: editingProduct.code.trim(),
      invoice_code: editingProduct.invoice_code?.trim() || null,
      name: editingProduct.name.trim(),
      unit_id: matchedUnit?.id || null,
      unit_name: editingProduct.unit_name || null,
      category: editingProduct.category,
      default_revenue_type: editingProduct.default_revenue_type || null,
      current_stock: Number(editingProduct.current_stock || 0),
      is_excise_tax: editingProduct.is_excise_tax,
      is_ecommerce: editingProduct.is_ecommerce,
      is_aggregated: editingProduct.is_aggregated,
    };

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('products')
        .update(updatedFields)
        .eq('id', editingProduct.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi cập nhật hàng hóa: ${error.message}`);
        return;
      }
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updatedFields } : p))
    );
    setEditingProduct(null);
  };

  // Xử lý Chỉnh sửa hàng loạt
  const handleSaveBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    const updates: Record<string, any> = {};
    if (bulkUnitName) updates.unit_name = bulkUnitName;
    if (bulkCategory) updates.category = bulkCategory;
    if (bulkRevenueType) updates.default_revenue_type = bulkRevenueType;

    if (Object.keys(updates).length === 0) {
      setIsBulkEditOpen(false);
      return;
    }

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('products')
        .update(updates)
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi chỉnh sửa hàng loạt: ${error.message}`);
        return;
      }
    }

    setProducts((prev) =>
      prev.map((p) => (selectedIds.includes(p.id) ? { ...p, ...updates } : p))
    );
    setIsBulkEditOpen(false);
    setBulkUnitName('');
    setBulkCategory('');
    setBulkRevenueType('');
  };

  const handleDeleteOne = async (p: ProductItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mặt hàng "${p.code} - ${p.name}"?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', p.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng hóa: ${error.message}`);
        return;
      }
    }

    setProducts((prev) => prev.filter((item) => item.id !== p.id));
    setSelectedIds((prev) => prev.filter((id) => id !== p.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} hàng hóa / dịch vụ đã chọn?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setProducts((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  // Cấu hình 12 cột hiển thị theo ảnh chụp màn hình sổ kho - tab hang hoa - dịch vụ.jpg
  const columns: TableColumnDef<ProductItem>[] = [
    {
      key: 'code',
      header: 'Mã hàng hóa',
      width: '130px',
      filterable: true,
      sortable: true,
      render: (row) => <span className="font-medium text-slate-800">{row.code}</span>,
    },
    {
      key: 'invoice_code',
      header: 'Mã HH theo HĐ',
      width: '130px',
      sortable: true,
      filterable: true,
      render: (row) => <span className="text-slate-500">{row.invoice_code || '-'}</span>,
    },
    {
      key: 'name',
      header: 'Tên hàng hóa',
      width: '260px',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className="text-slate-800 line-clamp-1" title={row.name}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'current_stock',
      header: 'Số lượng tồn',
      width: '120px',
      align: 'right',
      sortable: true,
      render: (row) => {
        const stock = Number(row.current_stock || 0);
        const colorClass =
          stock > 0
            ? 'text-emerald-600 font-semibold'
            : stock < 0
            ? 'text-red-600 font-semibold'
            : 'text-slate-600';
        return <span className={colorClass}>{formatVND(stock)}</span>;
      },
    },
    {
      key: 'unit_name',
      header: 'Đơn vị tính',
      width: '110px',
      sortable: true,
      filterable: true,
      render: (row) => <span className="text-slate-700">{row.unit_name || '-'}</span>,
    },
    {
      key: 'category',
      header: 'Phân loại',
      width: '115px',
      sortable: true,
      filterable: true,
      filterOptions: PRODUCT_CATEGORIES,
      render: (row) => (
        <span className="inline-block px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded">
          {row.category}
        </span>
      ),
    },
    {
      key: 'default_revenue_type',
      header: 'Loại thuế suất bán ra',
      width: '270px',
      sortable: true,
      filterable: true,
      filterOptions: REVENUE_TYPES,
      render: (row) => (
        <span
          className="text-slate-700 line-clamp-1"
          title={row.default_revenue_type || ''}
        >
          {row.default_revenue_type || '-'}
        </span>
      ),
    },
    {
      key: 'is_excise_tax',
      header: 'Hàng hóa TTĐB',
      width: '125px',
      align: 'center',
      filterable: true,
      render: (row) => (
        <span className="text-slate-500">{row.is_excise_tax ? 'Có' : '-'}</span>
      ),
    },
    {
      key: 'is_ecommerce',
      header: 'Sàn TMĐT',
      width: '100px',
      align: 'center',
      filterable: true,
      render: (row) => (
        <span className="text-slate-500">{row.is_ecommerce ? 'Có' : '-'}</span>
      ),
    },
    {
      key: 'is_aggregated',
      header: 'Tổng hợp nhập',
      width: '115px',
      align: 'center',
      render: (row) =>
        row.is_aggregated ? (
          <span className="inline-flex justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '140px',
      align: 'center',
      stickyRight: true,
      render: (row) => (
        <div className="flex items-center justify-center space-x-1">
          <button
            type="button"
            onClick={() => setEditingProduct({ ...row })}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-slate-200"
            title="Chỉnh sửa hàng hóa"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSwitchToConversionsTab && onSwitchToConversionsTab(row)}
            className="p-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
            title="Thiết lập quy đổi hàng hóa tự động"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMergeSourceIds([row.id]);
              setMergeTargetId(row.id);
              setIsMergeModalOpen(true);
            }}
            className="p-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
            title="Gộp hàng hóa này"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteOne(row)}
            className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-200"
            title="Xóa hàng hóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // Cột nhập liệu cho Popup "Thêm nhiều hàng hóa / dịch vụ"
  const modalColumns: ModalFieldColumn<ProductFormRow>[] = [
    {
      key: 'code',
      header: 'Mã hàng hóa',
      width: '140px',
      type: 'text',
      placeholder: 'VD: HDPE',
      required: true,
    },
    {
      key: 'invoice_code',
      header: 'Mã HH theo HĐ',
      width: '140px',
      type: 'text',
      placeholder: 'Tùy chọn',
    },
    {
      key: 'name',
      header: 'Tên hàng hóa',
      width: '240px',
      type: 'text',
      placeholder: 'Nhập tên hàng hóa...',
      required: true,
    },
    {
      key: 'unit_name',
      header: 'Đơn vị tính',
      width: '130px',
      type: 'select',
      options: unitNameOptions,
    },
    {
      key: 'category',
      header: 'Phân loại',
      width: '150px',
      type: 'select',
      options: PRODUCT_CATEGORIES,
      required: true,
    },
    {
      key: 'default_revenue_type',
      header: 'Loại thuế suất bán ra',
      width: '290px',
      type: 'select',
      options: REVENUE_TYPES,
    },
    {
      key: 'current_stock',
      header: 'Số lượng tồn đầu',
      width: '130px',
      type: 'number',
      placeholder: '0',
    },
  ];

  const bulkActions: BulkActionConfig<ProductFormRow>[] = [
    {
      label: 'Chọn loại thuế suất hàng loạt',
      targetField: 'default_revenue_type',
      options: REVENUE_TYPES,
    },
  ];

  const createDefaultProductRow = (): ProductFormRow => ({
    code: '',
    invoice_code: '',
    name: '',
    unit_name: unitNameOptions[0] || 'kg',
    category: 'Hàng hóa',
    default_revenue_type: '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    current_stock: 0,
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
  });

  const mapImportedProductRow = (raw: Record<string, any>): ProductFormRow => ({
    code: String(raw.code || '').trim(),
    invoice_code: String(raw.invoice_code || '').trim(),
    name: String(raw.name || '').trim(),
    unit_name: String(raw.unit_name || unitNameOptions[0] || 'kg').trim(),
    category: PRODUCT_CATEGORIES.includes(raw.category as any)
      ? (raw.category as ProductCategory)
      : 'Hàng hóa',
    default_revenue_type: REVENUE_TYPES.includes(raw.default_revenue_type as RevenueType)
      ? (raw.default_revenue_type as RevenueType)
      : '(GTGT: 1%; TNCN: 0,5%) Phân phối, cung cấp hàng hóa',
    current_stock: Number(raw.current_stock || 0),
    is_excise_tax: false,
    is_ecommerce: false,
    is_aggregated: true,
  });

  return (
    <div className="space-y-3">
      {/* Thanh nút nghiệp vụ phía trên bên trái (khớp ảnh chụp màn hình) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn gộp hàng hóa</span>
        </button>

        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => setIsBulkEditOpen(true)}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            selectedIds.length > 0
              ? 'bg-[#1565c0] text-white hover:bg-[#0d47a1]'
              : 'bg-blue-300/70 text-white cursor-not-allowed'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Chỉnh sửa hàng loạt</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm nhiều hàng hóa / dịch vụ</span>
        </button>

        <button
          type="button"
          onClick={handleOpenMergeModal}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#4285f4] hover:bg-[#1565c0] rounded transition"
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>
            Gộp hàng hóa / dịch vụ{' '}
            {selectedIds.length >= 2 ? `(${selectedIds.length})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => exportProductsToExcel(products, household)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>Xuất Excel</span>
        </button>

        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={handleBulkDelete}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded border transition ${
            selectedIds.length > 0
              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa</span>
        </button>
      </div>

      <SharedDataTable<ProductItem>
        columns={columns}
        data={products}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={true}
        searchPlaceholder="Tìm theo tên, mã HH, mã HH theo hóa đơn..."
        searchableKeys={['code', 'invoice_code', 'name']}
      />

      {/* Popup Thêm nhiều hàng hóa / dịch vụ */}
      <MultiRowModal<ProductFormRow>
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm nhiều hàng hóa / dịch vụ"
        columns={modalColumns}
        defaultRowFactory={createDefaultProductRow}
        excelConfig={PRODUCT_EXCEL_TEMPLATE_CONFIG}
        bulkActions={bulkActions}
        mapImportedRow={mapImportedProductRow}
        onSubmitAll={handleAddMultipleProducts}
      />

      {/* Popup Gộp hàng hóa / dịch vụ */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitMerge className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Gộp hàng hóa / dịch vụ bị trùng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleExecuteMerge}
              className="p-5 flex-1 overflow-y-auto space-y-4 text-xs"
            >
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 leading-relaxed">
                Khi gộp nhiều mã hàng bị trùng về <strong>1 Mã hàng chuẩn</strong>, hệ thống
                sẽ tự động cộng dồn số lượng tồn kho và chuyển toàn bộ lịch sử Phiếu nhập/xuất,
                Doanh thu, Chi phí của các mã bị trùng sang Mã hàng chuẩn, sau đó xóa các mã dư thừa.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1. Chọn Mã hàng chuẩn muốn giữ lại (Đích){' '}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn mã hàng chuẩn --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} (Tồn: {formatVND(p.current_stock)} {p.unit_name || ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  2. Tích chọn các mã hàng bị trùng cần gộp vào mã chuẩn trên:
                </label>
                <div className="border border-slate-200 rounded max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {products
                    .filter((p) => p.id !== mergeTargetId)
                    .map((p) => {
                      const checked = mergeSourceIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                            checked ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setMergeSourceIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== p.id)
                                    : [...prev, p.id]
                                )
                              }
                              className="rounded border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{p.code}</span>
                            <span className="text-slate-600 line-clamp-1">{p.name}</span>
                          </div>
                          <span className="text-slate-500 shrink-0 ml-2">
                            Tồn: {formatVND(p.current_stock)} {p.unit_name || ''}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-4 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isMerging}
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isMerging ? 'Đang gộp...' : 'Xác nhận gộp hàng hóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Chỉnh sửa hàng loạt */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Chỉnh sửa hàng loạt ({selectedIds.length} mặt hàng)
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBulkEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Đơn vị tính mới (Để trống nếu giữ nguyên)
                </label>
                <select
                  value={bulkUnitName}
                  onChange={(e) => setBulkUnitName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">-- Giữ nguyên --</option>
                  {unitNameOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phân loại mới
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">-- Giữ nguyên --</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Loại thuế suất bán ra mới
                </label>
                <select
                  value={bulkRevenueType}
                  onChange={(e) => setBulkRevenueType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">-- Giữ nguyên --</option>
                  {REVENUE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(false)}
                  className="px-4 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Cập nhật hàng loạt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Sửa 1 hàng hóa */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Chỉnh sửa hàng hóa / dịch vụ
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSingleProduct} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã hàng hóa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.code}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, code: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã HH theo HĐ
                  </label>
                  <input
                    type="text"
                    value={editingProduct.invoice_code || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        invoice_code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên hàng hóa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đơn vị tính
                  </label>
                  <select
                    value={editingProduct.unit_name || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        unit_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="">-- Chọn --</option>
                    {unitNameOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phân loại
                  </label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Số lượng tồn
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingProduct.current_stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        current_stock: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Loại thuế suất bán ra
                </label>
                <select
                  value={editingProduct.default_revenue_type || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      default_revenue_type: e.target.value as RevenueType,
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">-- Không chọn --</option>
                  {REVENUE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-5 pt-1">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_aggregated}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        is_aggregated: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Tổng hợp nhập xuất tồn</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_ecommerce}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        is_ecommerce: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Sàn TMĐT</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}