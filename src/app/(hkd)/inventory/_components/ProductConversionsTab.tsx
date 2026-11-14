// src/app/(hkd)/inventory/_components/ProductConversionsTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  PlaySquare,
  SquarePen,
  X,
  ArrowRight,
} from 'lucide-react';
import { ProductConversionItem, ProductItem } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';
import { formatVND } from '@/constants/hkd-constants';

interface ProductConversionsTabProps {
  conversions: ProductConversionItem[];
  setConversions: React.Dispatch<React.SetStateAction<ProductConversionItem[]>>;
  products: ProductItem[];
  initialSourceProduct?: ProductItem | null;
}

function formatDateTimeVN(isoStr?: string) {
  if (!isoStr) return '11/11/2026 10:57';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function ProductConversionsTab({
  conversions,
  setConversions,
  products,
  initialSourceProduct,
}: ProductConversionsTabProps) {
  const { household } = useHkd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductConversionItem | null>(null);

  const [sourceProductId, setSourceProductId] = useState('');
  const [sourceQty, setSourceQty] = useState<number>(1);
  const [targetProductId, setTargetProductId] = useState('');
  const [targetQty, setTargetQty] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (initialSourceProduct) {
      setEditingItem(null);
      setSourceProductId(initialSourceProduct.id);
      setSourceQty(1);
      setTargetProductId('');
      setTargetQty(1);
      setIsActive(true);
      setIsModalOpen(true);
    }
  }, [initialSourceProduct]);

  const openAddModal = () => {
    setEditingItem(null);
    setSourceProductId(products[0]?.id || '');
    setSourceQty(1);
    setTargetProductId(products[1]?.id || products[0]?.id || '');
    setTargetQty(1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ProductConversionItem) => {
    setEditingItem(item);
    setSourceProductId(item.source_product_id);
    setSourceQty(item.source_quantity);
    setTargetProductId(item.target_product_id);
    setTargetQty(item.target_quantity);
    setIsActive(item.is_active);
    setIsModalOpen(true);
  };

  const handleSaveConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceProductId || !targetProductId) {
      alert('Vui lòng chọn đầy đủ Hàng hóa nguồn và Hàng hóa đích.');
      return;
    }
    if (sourceProductId === targetProductId) {
      alert('Hàng hóa nguồn và Hàng hóa đích phải khác nhau.');
      return;
    }

    const srcProd = products.find((p) => p.id === sourceProductId);
    const tgtProd = products.find((p) => p.id === targetProductId);
    if (!srcProd || !tgtProd) return;

    const nowIso = new Date().toISOString();
    const supabase = createClient();

    const dbPayload = {
      household_id: household.id,
      source_product_id: srcProd.id,
      source_quantity: Number(sourceQty || 1),
      source_unit_name: srcProd.unit_name || 'kg',
      target_product_id: tgtProd.id,
      target_quantity: Number(targetQty || 1),
      target_unit_name: tgtProd.unit_name || 'kg',
      is_active: isActive,
    };

    if (editingItem) {
      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase
          .from('product_conversions')
          .update({ ...dbPayload, updated_at: nowIso })
          .eq('id', editingItem.id)
          .eq('household_id', household.id);
        if (error) {
          alert(`Lỗi cập nhật quy đổi: ${error.message}`);
          return;
        }
      }

      setConversions((prev) =>
        prev.map((c) =>
          c.id === editingItem.id
            ? {
                ...c,
                ...dbPayload,
                source_product_code: srcProd.code,
                source_product_name: srcProd.name,
                target_product_code: tgtProd.code,
                target_product_name: tgtProd.name,
                updated_at: nowIso,
              }
            : c
        )
      );
    } else {
      if (supabase && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('product_conversions')
          .insert([dbPayload])
          .select('*');
        if (error) {
          alert(`Lỗi thêm quy đổi: ${error.message}`);
          return;
        }
        if (data && data[0]) {
          const inserted = data[0] as ProductConversionItem;
          setConversions((prev) => [
            {
              ...inserted,
              source_product_code: srcProd.code,
              source_product_name: srcProd.name,
              target_product_code: tgtProd.code,
              target_product_name: tgtProd.name,
            },
            ...prev,
          ]);
        }
      } else {
        const newConversion: ProductConversionItem = {
          id: `conv-${Date.now()}`,
          ...dbPayload,
          source_product_code: srcProd.code,
          source_product_name: srcProd.name,
          target_product_code: tgtProd.code,
          target_product_name: tgtProd.name,
          created_at: nowIso,
          updated_at: nowIso,
        };
        setConversions((prev) => [newConversion, ...prev]);
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteOne = async (item: ProductConversionItem) => {
    if (!window.confirm('Xóa công thức quy đổi hàng hóa tự động này?')) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('product_conversions')
        .delete()
        .eq('id', item.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa quy đổi: ${error.message}`);
        return;
      }
    }

    setConversions((prev) => prev.filter((c) => c.id !== item.id));
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} quy tắc quy đổi đã chọn?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('product_conversions')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setConversions((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
  };

  // Làm giàu thông tin mã/tên hàng từ danh sách products
  const enrichedConversions = conversions.map((c) => {
    const src = products.find((p) => p.id === c.source_product_id);
    const tgt = products.find((p) => p.id === c.target_product_id);
    return {
      ...c,
      source_product_code: c.source_product_code || src?.code || '',
      source_product_name: c.source_product_name || src?.name || '',
      source_unit_name: c.source_unit_name || src?.unit_name || '',
      target_product_code: c.target_product_code || tgt?.code || '',
      target_product_name: c.target_product_name || tgt?.name || '',
      target_unit_name: c.target_unit_name || tgt?.unit_name || '',
    };
  });

  const columns: TableColumnDef<ProductConversionItem>[] = [
    {
      key: 'source_product_code',
      header: 'Mã HH nguồn',
      width: '130px',
      filterable: true,
      render: (row) => (
        <span className="font-semibold text-slate-800">{row.source_product_code}</span>
      ),
    },
    {
      key: 'source_product_name',
      header: 'Hàng hóa nguồn',
      width: '200px',
      filterable: true,
    },
    {
      key: 'source_quantity',
      header: 'SL nguồn',
      width: '100px',
      align: 'right',
      filterable: true,
      render: (row) => <span>{formatVND(row.source_quantity)}</span>,
    },
    {
      key: 'source_unit_name',
      header: 'Đơn vị nguồn',
      width: '110px',
      align: 'center',
    },
    {
      key: 'target_product_code',
      header: 'Mã HH đích',
      width: '130px',
      filterable: true,
      render: (row) => (
        <span className="font-semibold text-blue-700">{row.target_product_code}</span>
      ),
    },
    {
      key: 'target_product_name',
      header: 'Hàng hóa đích',
      width: '200px',
      filterable: true,
    },
    {
      key: 'target_quantity',
      header: 'SL đích',
      width: '100px',
      align: 'right',
      filterable: true,
      render: (row) => (
        <span className="font-semibold text-emerald-700">
          {formatVND(row.target_quantity)}
        </span>
      ),
    },
    {
      key: 'target_unit_name',
      header: 'Đơn vị đích',
      width: '110px',
      align: 'center',
    },
    {
      key: 'created_at',
      header: 'Ngày tạo',
      width: '150px',
      filterable: true,
      render: (row) => <span className="text-slate-600">{formatDateTimeVN(row.created_at)}</span>,
    },
    {
      key: 'updated_at',
      header: 'Ngày cập nhật',
      width: '150px',
      render: (row) => <span className="text-slate-600">{formatDateTimeVN(row.updated_at)}</span>,
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      width: '130px',
      align: 'center',
      filterable: true,
      render: (row) =>
        row.is_active ? (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            Đang hoạt động
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 rounded">
            Tạm ngưng
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '90px',
      align: 'center',
      stickyRight: true,
      render: (row) => (
        <div className="flex items-center justify-center space-x-1.5">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
            title="Chỉnh sửa"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteOne(row)}
            className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-200"
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const selectedSrcProd = products.find((p) => p.id === sourceProductId);
  const selectedTgtProd = products.find((p) => p.id === targetProductId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn quy đổi hàng hóa tự động</span>
        </button>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm quy đổi hàng hóa tự động</span>
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

      <SharedDataTable<ProductConversionItem>
        columns={columns}
        data={enrichedConversions}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={true}
        searchPlaceholder="Tìm hàng hóa nguồn/đích..."
        searchableKeys={[
          'source_product_code',
          'source_product_name',
          'target_product_code',
          'target_product_name',
        ]}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingItem
                  ? 'Chỉnh sửa quy đổi hàng hóa tự động'
                  : 'Thêm quy đổi hàng hóa tự động'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConversion} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Cụm Hàng hóa Nguồn */}
                <div className="p-3.5 border border-slate-200 rounded bg-slate-50/60 space-y-3">
                  <div className="font-bold text-slate-700 uppercase text-[11px]">
                    1. Hàng hóa nguồn (Đầu vào)
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Chọn hàng hóa nguồn <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={sourceProductId}
                      onChange={(e) => setSourceProductId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="">-- Chọn hàng hóa nguồn --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name} ({p.unit_name || 'kg'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        SL nguồn <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        required
                        value={sourceQty}
                        onChange={(e) => setSourceQty(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-right"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Đơn vị nguồn
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedSrcProd?.unit_name || 'kg'}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Cụm Hàng hóa Đích */}
                <div className="p-3.5 border border-blue-200 rounded bg-blue-50/30 space-y-3">
                  <div className="font-bold text-blue-700 uppercase text-[11px] flex items-center space-x-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>2. Hàng hóa đích (Sau quy đổi)</span>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Chọn hàng hóa đích <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={targetProductId}
                      onChange={(e) => setTargetProductId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="">-- Chọn hàng hóa đích --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name} ({p.unit_name || 'kg'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        SL đích <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        required
                        value={targetQty}
                        onChange={(e) => setTargetQty(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-right"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Đơn vị đích
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedTgtProd?.unit_name || 'kg'}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-semibold text-slate-700">
                  Kích hoạt quy đổi tự động khi nhập kho
                </span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Lưu quy đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}