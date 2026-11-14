// src/app/(hkd)/inventory/_components/WarehousesTab.tsx
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
} from 'lucide-react';
import { WarehouseItem } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';
import { exportWarehousesToExcel } from '@/lib/excel/tt88-exporter';

interface WarehousesTabProps {
  warehouses: WarehouseItem[];
  setWarehouses: React.Dispatch<React.SetStateAction<WarehouseItem[]>>;
}

function formatDateTimeVN(isoStr?: string) {
  if (!isoStr) return '18/04/2026 16:12';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(isoStr)) return isoStr;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function WarehousesTab({ warehouses, setWarehouses }: WarehousesTabProps) {
  const { household } = useHkd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);

  const openAddModal = () => {
    setEditingWarehouse(null);
    setFormName('');
    setFormSortOrder(0);
    setFormDescription('');
    setFormIsDefault(warehouses.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (w: WarehouseItem) => {
    setEditingWarehouse(w);
    setFormName(w.name);
    setFormSortOrder(w.sort_order || 0);
    setFormDescription(w.description || '');
    setFormIsDefault(w.is_default);
    setIsModalOpen(true);
  };

  // Xử lý đặt nhanh 1 kho làm Mặc định ngay trên bảng
  const handleSetDefaultWarehouse = async (target: WarehouseItem) => {
    if (target.is_default) return;
    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      await supabase
        .from('warehouses')
        .update({ is_default: false })
        .eq('household_id', household.id);
      const { error } = await supabase
        .from('warehouses')
        .update({ is_default: true })
        .eq('id', target.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi đặt kho mặc định: ${error.message}`);
        return;
      }
    }

    setWarehouses((prev) =>
      prev.map((w) => ({
        ...w,
        is_default: w.id === target.id,
      }))
    );
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    const nowIso = new Date().toISOString();
    const supabase = createClient();

    if (editingWarehouse) {
      const payload = {
        name: trimmedName,
        sort_order: Number(formSortOrder || 0),
        description: formDescription.trim() || null,
        is_default: formIsDefault,
        updated_at: nowIso,
      };

      if (supabase && isSupabaseConfigured) {
        if (formIsDefault) {
          await supabase
            .from('warehouses')
            .update({ is_default: false })
            .eq('household_id', household.id);
        }
        const { error } = await supabase
          .from('warehouses')
          .update(payload)
          .eq('id', editingWarehouse.id)
          .eq('household_id', household.id);
        if (error) {
          alert(`Lỗi cập nhật nhà kho: ${error.message}`);
          return;
        }
      }

      setWarehouses((prev) =>
        prev.map((item) => {
          if (item.id === editingWarehouse.id) return { ...item, ...payload };
          return formIsDefault ? { ...item, is_default: false } : item;
        })
      );
    } else {
      const payload = {
        household_id: household.id,
        name: trimmedName,
        sort_order: Number(formSortOrder || 0),
        description: formDescription.trim() || null,
        is_default: formIsDefault,
      };

      if (supabase && isSupabaseConfigured) {
        if (formIsDefault) {
          await supabase
            .from('warehouses')
            .update({ is_default: false })
            .eq('household_id', household.id);
        }
        const { data, error } = await supabase
          .from('warehouses')
          .insert([payload])
          .select('*');
        if (error) {
          alert(`Lỗi thêm nhà kho: ${error.message}`);
          return;
        }
        if (data && data[0]) {
          const inserted = data[0] as WarehouseItem;
          setWarehouses((prev) => [
            ...(formIsDefault ? prev.map((w) => ({ ...w, is_default: false })) : prev),
            inserted,
          ]);
        }
      } else {
        const newWh: WarehouseItem = {
          id: `wh-${Date.now()}`,
          ...payload,
          created_at: nowIso,
          updated_at: nowIso,
        };
        setWarehouses((prev) => [
          ...(formIsDefault ? prev.map((w) => ({ ...w, is_default: false })) : prev),
          newWh,
        ]);
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteOne = async (w: WarehouseItem) => {
    if (w.is_default && warehouses.length > 1) {
      alert('Không thể xóa kho đang đặt làm Mặc định. Vui lòng chọn kho khác làm mặc định trước.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa kho "${w.name}" không?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', w.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa kho: ${error.message}`);
        return;
      }
    }

    setWarehouses((prev) => prev.filter((item) => item.id !== w.id));
    setSelectedIds((prev) => prev.filter((id) => id !== w.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} nhà kho đã chọn?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setWarehouses((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  const columns: TableColumnDef<WarehouseItem>[] = [
    {
      key: 'name',
      header: 'Tên nhà kho',
      width: '220px',
      filterable: true,
      sortable: true,
      render: (row) => <span className="font-medium text-slate-800">{row.name}</span>,
    },
    {
      key: 'sort_order',
      header: 'Độ ưu tiên sắp xếp',
      width: '160px',
      align: 'center',
      filterable: true,
      sortable: true,
    },
    {
      key: 'description',
      header: 'Diễn giải',
      width: '220px',
      filterable: true,
      render: (row) => <span className="text-slate-600">{row.description || ''}</span>,
    },
    {
      key: 'is_default',
      header: 'Mặc định',
      width: '120px',
      align: 'center',
      render: (row) =>
        row.is_default ? (
          <span
            className="inline-flex items-center justify-center text-emerald-600"
            title="Kho mặc định"
          >
            <CheckCircle2 className="w-4 h-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => handleSetDefaultWarehouse(row)}
            className="text-[11px] text-slate-400 hover:text-blue-600 underline"
          >
            Đặt mặc định
          </button>
        ),
    },
    {
      key: 'created_at',
      header: 'Ngày tạo',
      width: '160px',
      filterable: true,
      render: (row) => <span className="text-slate-600">{formatDateTimeVN(row.created_at)}</span>,
    },
    {
      key: 'updated_at',
      header: 'Ngày cập nhật',
      width: '160px',
      filterable: true,
      render: (row) => <span className="text-slate-600">{formatDateTimeVN(row.updated_at)}</span>,
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn nhà kho</span>
        </button>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm nhà kho</span>
        </button>

        <button
          type="button"
          onClick={() => exportWarehousesToExcel(warehouses, household)}
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

      <SharedDataTable<WarehouseItem>
        columns={columns}
        data={warehouses}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={true}
        searchPlaceholder="Tìm theo tên nhà kho..."
        searchableKeys={['name', 'description']}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingWarehouse ? 'Chỉnh sửa nhà kho' : 'Thêm nhà kho'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên nhà kho <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nhà kho, Kho chính, Kho phế liệu..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Độ ưu tiên sắp xếp
                </label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diễn giải</label>
                <input
                  type="text"
                  placeholder="Ghi chú địa chỉ hoặc mục đích kho..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-semibold text-slate-700">
                  Đặt làm kho mặc định (Chỉ 1 kho được chọn mặc định)
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
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}