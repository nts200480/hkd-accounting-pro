// src/app/(hkd)/partners/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  FileDown,
  Trash2,
  PlaySquare,
  SquarePen,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  PARTNER_TYPES,
  EXPENSE_TYPES,
  PartnerType,
  ExpenseType,
} from '@/constants/hkd-constants';
import { Partner, PartnerFormRow } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';
import {
  MultiRowModal,
  ModalFieldColumn,
  BulkActionConfig,
} from '@/components/shared/MultiRowModal';
import { PARTNER_EXCEL_TEMPLATE_CONFIG } from '@/lib/excel/excel-templates';
import { exportPartnersToExcel } from '@/lib/excel/tt88-exporter';

// Dữ liệu mẫu thực tế (khớp với ảnh chụp màn hình của bạn) dùng khi chạy thử nghiệm локаl chưa gắn .env Supabase
const INITIAL_SAMPLE_PARTNERS: Partner[] = [
  {
    id: 'p-1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Đoàn Văn Nhưng',
    tax_code: '036074015816',
    partner_type: 'Nhà cung cấp',
    default_expense_type: 'Các khoản chi phí khác',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: '120 Nguyễn Văn Cừ - HH8, Phường Hải Vân, TP Đà Nẵng, Việt Nam',
  },
  {
    id: 'p-2',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Nguyễn Thị Hồng',
    tax_code: '036182019029',
    partner_type: 'Nhà cung cấp',
    default_expense_type: 'Các khoản chi phí khác',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: 'Tổ 6, Vĩnh Trung, Thanh Khê, Đà Nẵng',
  },
  {
    id: 'p-3',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Hồ Văn Thành',
    tax_code: '045098007427',
    partner_type: 'Nhà cung cấp',
    default_expense_type: 'Các khoản chi phí khác',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: 'Thôn Tà Rụt 2, Tà Rụt, Đa Krông, Quảng Trị',
  },
  {
    id: 'p-4',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI HÒA TIẾN',
    tax_code: '0401295826',
    partner_type: 'Khách hàng',
    default_expense_type: '',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: 'Thửa đất số 388, tờ bản đồ số 10, Thôn 5, Xã Hòa Tiến, Thành phố Đà Nẵng',
  },
  {
    id: 'p-5',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'HỘ KINH DOANH NGUYỄN THỊ MỸ',
    tax_code: '048185002306',
    partner_type: 'Khách hàng',
    default_expense_type: '',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: 'Thôn Phú Sơn 1, Xã Hòa Tiến, TP Đà Nẵng, Việt Nam',
  },
  {
    id: 'p-6',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Công ty Cổ phần Viễn thông FPT',
    tax_code: '0101778163',
    partner_type: 'Nhà cung cấp',
    default_expense_type: 'Các khoản chi phí khác',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: 'Tầng 2, tòa nhà FPT Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
  },
];

export default function PartnersPage() {
  const { household } = useHkd();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Trạng thái mở Popup Thêm nhiều đối tác
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Trạng thái mở Popup Chỉnh sửa 1 đối tác
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Tải danh sách đối tác từ Supabase (hoặc dữ liệu mẫu nếu chưa cấu hình Supabase)
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (supabase && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('partners')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPartners((data as Partner[]) || []);
      } else {
        // Chế độ Local state khi chưa cấu hình biến môi trường Supabase
        setPartners((prev) => (prev.length > 0 ? prev : INITIAL_SAMPLE_PARTNERS));
      }
    } catch (err) {
      console.error('Lỗi tải danh sách đối tác:', err);
    } finally {
      setLoading(false);
    }
  }, [household.id]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Xử lý Thêm nhiều đối tác (từ nhập tay hoặc Import Excel trên Popup)
  const handleAddMultiplePartners = async (rows: PartnerFormRow[]) => {
    const validRows = rows.filter((r) => r.name && r.name.trim() !== '');
    if (validRows.length === 0) return;

    const payload = validRows.map((r) => ({
      household_id: household.id,
      name: r.name.trim(),
      tax_code: r.tax_code?.trim() || null,
      partner_type: (PARTNER_TYPES.includes(r.partner_type as PartnerType)
        ? r.partner_type
        : 'Khách hàng & NCC') as PartnerType,
      default_expense_type:
        r.default_expense_type &&
        EXPENSE_TYPES.includes(r.default_expense_type as ExpenseType)
          ? (r.default_expense_type as ExpenseType)
          : null,
      bank_account_number: r.bank_account_number?.trim() || null,
      contact_person: r.contact_person?.trim() || null,
      legal_representative: r.legal_representative?.trim() || null,
      address: r.address?.trim() || null,
    }));

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('partners')
        .insert(payload)
        .select('*');

      if (error) {
        throw new Error(`Không thể lưu đối tác vào Supabase: ${error.message}`);
      }
      if (data) {
        setPartners((prev) => [...(data as Partner[]), ...prev]);
      }
    } else {
      const localInserted: Partner[] = payload.map((item, idx) => ({
        ...item,
        id: `local-${Date.now()}-${idx}`,
      }));
      setPartners((prev) => [...localInserted, ...prev]);
    }
  };

  // Xử lý Cập nhật 1 đối tác
  const handleUpdateSinglePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || !editingPartner.name.trim()) return;

    const updatedPayload = {
      name: editingPartner.name.trim(),
      tax_code: editingPartner.tax_code?.trim() || null,
      partner_type: editingPartner.partner_type,
      default_expense_type: editingPartner.default_expense_type || null,
      bank_account_number: editingPartner.bank_account_number?.trim() || null,
      contact_person: editingPartner.contact_person?.trim() || null,
      legal_representative: editingPartner.legal_representative?.trim() || null,
      address: editingPartner.address?.trim() || null,
    };

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('partners')
        .update(updatedPayload)
        .eq('id', editingPartner.id)
        .eq('household_id', household.id);

      if (error) {
        alert(`Lỗi cập nhật đối tác: ${error.message}`);
        return;
      }
    }

    setPartners((prev) =>
      prev.map((p) =>
        p.id === editingPartner.id ? { ...p, ...updatedPayload } : p
      )
    );
    setEditingPartner(null);
  };

  // Xử lý Xóa 1 đối tác
  const handleDeleteOne = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đối tác "${name}" không?`)) {
      return;
    }

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id)
        .eq('household_id', household.id);

      if (error) {
        alert(`Lỗi xóa đối tác: ${error.message}`);
        return;
      }
    }

    setPartners((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  // Xử lý Xóa hàng loạt đối tác đã tích chọn
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa ${selectedIds.length} đối tác đã chọn không?`
      )
    ) {
      return;
    }

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('partners')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);

      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setPartners((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  // Cấu hình 9 cột dữ liệu + cột Thao tác trên bảng chính (khớp ảnh Mãu 2.jpg & thêm đối tác.jpg)
  const tableColumns: TableColumnDef<Partner>[] = [
    {
      key: 'name',
      header: 'Tên',
      width: '220px',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className="font-medium text-slate-800">{row.name}</span>
      ),
    },
    {
      key: 'tax_code',
      header: 'Mã số thuế',
      width: '140px',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className="text-slate-600">{row.tax_code || ''}</span>
      ),
    },
    {
      key: 'partner_type',
      header: 'Loại đối tác',
      width: '150px',
      sortable: true,
      filterable: true,
      filterOptions: PARTNER_TYPES,
      render: (row) => (
        <span className="inline-block px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded">
          {row.partner_type}
        </span>
      ),
    },
    {
      key: 'default_expense_type',
      header: 'Cài đặt loại chi phí',
      width: '210px',
      filterable: true,
      filterOptions: EXPENSE_TYPES,
      render: (row) => (
        <span className="text-slate-700">{row.default_expense_type || ''}</span>
      ),
    },
    {
      key: 'bank_account_number',
      header: 'Số tài khoản',
      width: '140px',
      filterable: true,
      render: (row) => (
        <span className="text-slate-600">{row.bank_account_number || ''}</span>
      ),
    },
    {
      key: 'contact_person',
      header: 'Người liên hệ',
      width: '150px',
      render: (row) => (
        <span className="text-slate-600">{row.contact_person || ''}</span>
      ),
    },
    {
      key: 'legal_representative',
      header: 'Người đại diện pháp luật',
      width: '180px',
      render: (row) => (
        <span className="text-slate-600">{row.legal_representative || ''}</span>
      ),
    },
    {
      key: 'address',
      header: 'Địa chỉ',
      width: '320px',
      render: (row) => (
        <span className="text-slate-600 line-clamp-1" title={row.address || ''}>
          {row.address || ''}
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
            onClick={() => setEditingPartner({ ...row })}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition"
            title="Chỉnh sửa đối tác"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteOne(row.id, row.name)}
            className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-200 transition"
            title="Xóa đối tác"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // Cấu hình các cột nhập liệu trên Popup "Thêm nhiều đối tác"
  const modalColumns: ModalFieldColumn<PartnerFormRow>[] = [
    {
      key: 'name',
      header: 'Tên đối tác',
      width: '210px',
      type: 'text',
      placeholder: 'Nhập tên đối tác...',
      required: true,
    },
    {
      key: 'tax_code',
      header: 'Mã số thuế',
      width: '140px',
      type: 'text',
      placeholder: 'Mã số thuế / CCCD',
    },
    {
      key: 'partner_type',
      header: 'Loại đối tác',
      width: '165px',
      type: 'select',
      options: PARTNER_TYPES,
      required: true,
    },
    {
      key: 'default_expense_type',
      header: 'Cài đặt loại chi phí mặc định',
      width: '230px',
      type: 'select',
      placeholder: 'Chọn loại chi phí...',
      options: EXPENSE_TYPES,
    },
    {
      key: 'bank_account_number',
      header: 'Số tài khoản',
      width: '150px',
      type: 'text',
      placeholder: 'Số tài khoản NH',
    },
    {
      key: 'contact_person',
      header: 'Người liên hệ',
      width: '160px',
      type: 'text',
      placeholder: 'Người liên hệ',
    },
    {
      key: 'legal_representative',
      header: 'Người đại diện',
      width: '160px',
      type: 'text',
      placeholder: 'Người đại diện PL',
    },
    {
      key: 'address',
      header: 'Địa chỉ',
      width: '260px',
      type: 'text',
      placeholder: 'Nhập địa chỉ...',
    },
  ];

  // Nút thao tác hàng loạt trên Popup: "Chọn loại chi phí hàng loạt"
  const partnerBulkActions: BulkActionConfig<PartnerFormRow>[] = [
    {
      label: 'Chọn loại chi phí hàng loạt',
      targetField: 'default_expense_type',
      options: EXPENSE_TYPES,
    },
  ];

  const createDefaultPartnerRow = (): PartnerFormRow => ({
    name: '',
    tax_code: '',
    partner_type: 'Khách hàng & NCC',
    default_expense_type: '',
    bank_account_number: '',
    contact_person: '',
    legal_representative: '',
    address: '',
  });

  // Ánh xạ dữ liệu từ file Excel Import vào lưới Popup
  const mapExcelRowToPartnerForm = (raw: Record<string, any>): PartnerFormRow => {
    const rawPartnerType = String(raw.partner_type || '').trim();
    const matchedPartnerType = PARTNER_TYPES.includes(rawPartnerType as PartnerType)
      ? (rawPartnerType as PartnerType)
      : 'Khách hàng & NCC';

    const rawExpenseType = String(raw.default_expense_type || '').trim();
    const matchedExpenseType = EXPENSE_TYPES.includes(rawExpenseType as ExpenseType)
      ? (rawExpenseType as ExpenseType)
      : '';

    return {
      name: String(raw.name || '').trim(),
      tax_code: String(raw.tax_code || '').trim(),
      partner_type: matchedPartnerType,
      default_expense_type: matchedExpenseType,
      bank_account_number: String(raw.bank_account_number || '').trim(),
      contact_person: String(raw.contact_person || '').trim(),
      legal_representative: String(raw.legal_representative || '').trim(),
      address: String(raw.address || '').trim(),
    };
  };

  return (
    <div className="space-y-3">
      {/* Thanh nút nghiệp vụ góc trên bên phải */}
      <div className="bg-white border border-slate-200 rounded px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          {loading && (
            <span className="inline-flex items-center text-blue-600">
              <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
              Đang tải dữ liệu...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            type="button"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
          >
            <PlaySquare className="w-3.5 h-3.5" />
            <span>Hướng dẫn quản lý đối tác</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm nhiều đối tác</span>
          </button>

          <button
            type="button"
            onClick={() => exportPartnersToExcel(partners, household)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Xuất excel</span>
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
            <span>Xóa {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Bảng Danh sách đối tác */}
      <SharedDataTable<Partner>
        columns={tableColumns}
        data={partners}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={false}
        searchPlaceholder="Tìm theo tên, mã số thuế,..."
        searchableKeys={['name', 'tax_code', 'address', 'contact_person']}
        emptyMessage="Không có dữ liệu"
      />

      {/* Popup Thêm nhiều đối tác (Nhập tay từng dòng + Tải mẫu Excel + Nhập Excel) */}
      <MultiRowModal<PartnerFormRow>
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm nhiều đối tác"
        columns={modalColumns}
        defaultRowFactory={createDefaultPartnerRow}
        excelConfig={PARTNER_EXCEL_TEMPLATE_CONFIG}
        bulkActions={partnerBulkActions}
        mapImportedRow={mapExcelRowToPartnerForm}
        onSubmitAll={handleAddMultiplePartners}
      />

      {/* Popup Chỉnh sửa 1 đối tác */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Chỉnh sửa thông tin đối tác
              </h3>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSinglePartner} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đối tác <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingPartner.name}
                  onChange={(e) =>
                    setEditingPartner({ ...editingPartner, name: e.target.value })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={editingPartner.tax_code || ''}
                    onChange={(e) =>
                      setEditingPartner({ ...editingPartner, tax_code: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Loại đối tác
                  </label>
                  <select
                    value={editingPartner.partner_type}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        partner_type: e.target.value as PartnerType,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-blue-500"
                  >
                    {PARTNER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cài đặt loại chi phí mặc định
                </label>
                <select
                  value={editingPartner.default_expense_type || ''}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      default_expense_type: e.target.value as ExpenseType | '',
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Không cài đặt --</option>
                  {EXPENSE_TYPES.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Số tài khoản
                  </label>
                  <input
                    type="text"
                    value={editingPartner.bank_account_number || ''}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        bank_account_number: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Người liên hệ
                  </label>
                  <input
                    type="text"
                    value={editingPartner.contact_person || ''}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        contact_person: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Người đại diện PL
                  </label>
                  <input
                    type="text"
                    value={editingPartner.legal_representative || ''}
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        legal_representative: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={editingPartner.address || ''}
                  onChange={(e) =>
                    setEditingPartner({ ...editingPartner, address: e.target.value })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="px-4 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
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