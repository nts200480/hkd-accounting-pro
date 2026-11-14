// src/app/(hkd)/inventory/_components/UnitsTab.tsx
'use client';

import React, { useState } from 'react';
import { Plus, FileDown, Trash2, PlaySquare, SquarePen, X } from 'lucide-react';
import { UnitItem } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';
import { exportUnitsToExcel } from '@/lib/excel/tt88-exporter';

interface UnitsTabProps {
  units: UnitItem[];
  setUnits: React.Dispatch<React.SetStateAction<UnitItem[]>>;
}

function formatDateTimeVN(isoStr?: string) {
  if (!isoStr) return '13/07/2026 11:54';
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

export function UnitsTab({ units, setUnits }: UnitsTabProps) {
  const { household } = useHkd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formDescription, setFormDescription] = useState('');

  const openAddModal = () => {
    setEditingUnit(null);
    setFormName('');
    setFormSortOrder(0);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: UnitItem) => {
    setEditingUnit(u);
    setFormName(u.name);
    setFormSortOrder(u.sort_order || 0);
    setFormDescription(u.description || '');
    setIsModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    const nowIso = new Date().toISOString();
    const supabase = createClient();

    if (editingUnit) {
      const payload = {
        name: trimmedName,
        sort_order: Number(formSortOrder || 0),
        description: formDescription.trim() || null,
        updated_at: nowIso,
      };

      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase
          .from('units')
          .update(payload)
          .eq('id', editingUnit.id)
          .eq('household_id', household.id);
        if (error) {
          alert(`Lỗi cập nhật đơn vị: ${error.message}`);
          return;
        }
      }

      setUnits((prev) =>
        prev.map((item) => (item.id === editingUnit.id ? { ...item, ...payload } : item))
      );
    } else {
      const payload = {
        household_id: household.id,
        name: trimmedName,
        sort_order: Number(formSortOrder || 0),
        description: formDescription.trim() || null,
      };

      if (supabase && isSupabaseConfigured) {
        const { data, error } = await supabase.from('units').insert([payload]).select('*');
        if (error) {
          alert(`Lỗi thêm đơn vị: ${error.message}`);
          return;
        }
        if (data && data[0]) {
          setUnits((prev) => [...prev, data[0] as UnitItem]);
        }
      } else {
        const newUnit: UnitItem = {
          id: `unit-${Date.now()}`,
          ...payload,
          created_at: nowIso,
          updated_at: nowIso,
        };
        setUnits((prev) => [...prev, newUnit]);
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteOne = async (u: UnitItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn vị tính "${u.name}" không?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', u.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Không thể xóa đơn vị tính: ${error.message}`);
        return;
      }
    }

    setUnits((prev) => prev.filter((item) => item.id !== u.id));
    setSelectedIds((prev) => prev.filter((id) => id !== u.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} đơn vị hàng hóa đã chọn?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('units')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setUnits((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  const columns: TableColumnDef<UnitItem>[] = [
    {
      key: 'name',
      header: 'Tên đơn vị hàng hóa',
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
      width: '240px',
      filterable: true,
      render: (row) => <span className="text-slate-600">{row.description || ''}</span>,
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
      {/* Thanh nút chức năng góc trên bên phải */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn đơn vị hàng hóa</span>
        </button>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm đơn vị hàng hóa</span>
        </button>

        <button
          type="button"
          onClick={() => exportUnitsToExcel(units, household)}
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

      <SharedDataTable<UnitItem>
        columns={columns}
        data={units}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={true}
        searchPlaceholder="Tìm theo tên đơn vị..."
        searchableKeys={['name', 'description']}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingUnit ? 'Chỉnh sửa đơn vị hàng hóa' : 'Thêm đơn vị hàng hóa'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đơn vị hàng hóa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: kg, cái, thùng, tấn..."
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
                  placeholder="Ghi chú thêm về đơn vị tính..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

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