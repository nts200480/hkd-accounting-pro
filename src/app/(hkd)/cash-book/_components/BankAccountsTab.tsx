// src/app/(hkd)/cash-book/_components/BankAccountsTab.tsx
'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  SquarePen,
  X,
  CheckCircle2,
  PlaySquare,
} from 'lucide-react';
import { BankAccountItem } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { SharedDataTable, TableColumnDef } from '@/components/shared/SharedDataTable';

interface BankAccountsTabProps {
  bankAccounts: BankAccountItem[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccountItem[]>>;
}

export function BankAccountsTab({
  bankAccounts,
  setBankAccounts,
}: BankAccountsTabProps) {
  const { household } = useHkd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccountItem | null>(null);

  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const openAddModal = () => {
    setEditingBank(null);
    setAccountName('');
    setAccountNumber('');
    setBankName('');
    setBranchName('');
    setIsDefault(bankAccounts.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (item: BankAccountItem) => {
    setEditingBank(item);
    setAccountName(item.account_name);
    setAccountNumber(item.account_number);
    setBankName(item.bank_name);
    setBranchName(item.branch_name || '');
    setIsDefault(item.is_default);
    setIsModalOpen(true);
  };

  const handleSetDefaultBank = async (target: BankAccountItem) => {
    if (target.is_default) return;
    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('household_id', household.id);
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_default: true })
        .eq('id', target.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi đặt tài khoản mặc định: ${error.message}`);
        return;
      }
    }

    setBankAccounts((prev) =>
      prev.map((b) => ({
        ...b,
        is_default: b.id === target.id,
      }))
    );
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !accountNumber.trim() || !bankName.trim()) return;

    const supabase = createClient();
    const payload = {
      household_id: household.id,
      account_name: accountName.trim(),
      account_number: accountNumber.trim(),
      bank_name: bankName.trim(),
      branch_name: branchName.trim() || null,
      is_default: isDefault,
    };

    if (editingBank) {
      if (supabase && isSupabaseConfigured) {
        if (isDefault) {
          await supabase
            .from('bank_accounts')
            .update({ is_default: false })
            .eq('household_id', household.id);
        }
        const { error } = await supabase
          .from('bank_accounts')
          .update(payload)
          .eq('id', editingBank.id)
          .eq('household_id', household.id);
        if (error) {
          alert(`Lỗi cập nhật tài khoản ngân hàng: ${error.message}`);
          return;
        }
      }

      setBankAccounts((prev) =>
        prev.map((item) => {
          if (item.id === editingBank.id) return { ...item, ...payload };
          return isDefault ? { ...item, is_default: false } : item;
        })
      );
    } else {
      if (supabase && isSupabaseConfigured) {
        if (isDefault) {
          await supabase
            .from('bank_accounts')
            .update({ is_default: false })
            .eq('household_id', household.id);
        }
        const { data, error } = await supabase
          .from('bank_accounts')
          .insert([payload])
          .select('*');
        if (error) {
          alert(`Lỗi thêm tài khoản ngân hàng: ${error.message}`);
          return;
        }
        if (data && data[0]) {
          const inserted = data[0] as BankAccountItem;
          setBankAccounts((prev) => [
            ...(isDefault ? prev.map((b) => ({ ...b, is_default: false })) : prev),
            inserted,
          ]);
        }
      } else {
        const newBank: BankAccountItem = {
          id: `bank-${Date.now()}`,
          ...payload,
        };
        setBankAccounts((prev) => [
          ...(isDefault ? prev.map((b) => ({ ...b, is_default: false })) : prev),
          newBank,
        ]);
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteOne = async (item: BankAccountItem) => {
    if (item.is_default && bankAccounts.length > 1) {
      alert('Không thể xóa tài khoản đang đặt làm Mặc định.');
      return;
    }
    if (!window.confirm(`Xóa tài khoản ngân hàng "${item.account_name}"?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', item.id)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa tài khoản: ${error.message}`);
        return;
      }
    }

    setBankAccounts((prev) => prev.filter((b) => b.id !== item.id));
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} tài khoản ngân hàng đã chọn?`)) return;

    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .in('id', selectedIds)
        .eq('household_id', household.id);
      if (error) {
        alert(`Lỗi xóa hàng loạt: ${error.message}`);
        return;
      }
    }

    setBankAccounts((prev) => prev.filter((b) => !selectedIds.includes(b.id)));
    setSelectedIds([]);
  };

  const columns: TableColumnDef<BankAccountItem>[] = [
    {
      key: 'account_name',
      header: 'Tên tài khoản (Đối chiếu Excel)',
      width: '220px',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className="font-semibold text-slate-800">{row.account_name}</span>
      ),
    },
    {
      key: 'account_number',
      header: 'Số tài khoản',
      width: '160px',
      sortable: true,
      filterable: true,
    },
    {
      key: 'bank_name',
      header: 'Ngân hàng',
      width: '200px',
      sortable: true,
      filterable: true,
    },
    {
      key: 'branch_name',
      header: 'Chi nhánh',
      width: '180px',
      render: (row) => <span className="text-slate-600">{row.branch_name || '-'}</span>,
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
            title="Tài khoản mặc định khi Import Excel"
          >
            <CheckCircle2 className="w-4 h-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => handleSetDefaultBank(row)}
            className="text-[11px] text-slate-400 hover:text-blue-600 underline"
          >
            Đặt mặc định
          </button>
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <PlaySquare className="w-3.5 h-3.5" />
          <span>Hướng dẫn quản lý ngân hàng</span>
        </button>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm tài khoản ngân hàng</span>
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

      <SharedDataTable<BankAccountItem>
        columns={columns}
        data={bankAccounts}
        rowKey={(row) => row.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showIndexColumn={true}
        searchPlaceholder="Tìm theo tên TK, số tài khoản, ngân hàng..."
        searchableKeys={['account_name', 'account_number', 'bank_name']}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingBank
                  ? 'Chỉnh sửa tài khoản ngân hàng'
                  : 'Thêm tài khoản ngân hàng'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên gợi nhớ / Tên tài khoản (Dùng khớp cột Tài khoản khi Import Excel){' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: VCB Chính, ACB HKD..."
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tài khoản <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập số tài khoản..."
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên ngân hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Vietcombank, ACB, VietinBank, MB..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chi nhánh
                </label>
                <input
                  type="text"
                  placeholder="VD: Chi nhánh Đà Nẵng"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-semibold text-slate-700">
                  Đặt làm Tài khoản ngân hàng mặc định
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
                  Lưu tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}