// src/app/(hkd)/cash-book/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BankAccountItem } from '@/types/database.types';
import { useHkd } from '@/context/HkdContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { BankAccountsTab } from './_components/BankAccountsTab';

export type CashBookSubTabKey = 'cash' | 'bank' | 'bank-accounts';

const INITIAL_BANKS: BankAccountItem[] = [
  {
    id: 'ba-1',
    household_id: '00000000-0000-0000-0000-000000000001',
    account_name: 'Vietcombank Chính',
    account_number: '0041000999888',
    bank_name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    branch_name: 'Chi nhánh Đà Nẵng',
    is_default: true,
  },
];

export default function CashBookPage() {
  const { household } = useHkd();
  // Mở mặc định tab 'bank-accounts' ở Bước 1.3 để test ngay danh mục ngân hàng
  const [activeTab, setActiveTab] = useState<CashBookSubTabKey>('bank-accounts');
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);

  const fetchBankAccounts = useCallback(async () => {
    const supabase = createClient();
    if (supabase && isSupabaseConfigured) {
      const { data } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: true });

      setBankAccounts(
        data && data.length > 0 ? (data as BankAccountItem[]) : INITIAL_BANKS
      );
    } else {
      setBankAccounts(INITIAL_BANKS);
    }
  }, [household.id]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  return (
    <div className="space-y-3">
      {/* Thanh 3 Tab con của Sổ chi tiết tiền (S2e-HKD) */}
      <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('cash')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition ${
            activeTab === 'cash'
              ? 'bg-[#1565c0] text-white border-[#1565c0] font-semibold'
              : 'bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/70'
          }`}
        >
          Sổ chi tiết tiền mặt
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bank')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition ${
            activeTab === 'bank'
              ? 'bg-[#1565c0] text-white border-[#1565c0] font-semibold'
              : 'bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/70'
          }`}
        >
          Sổ tiền gửi ngân hàng
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bank-accounts')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition ${
            activeTab === 'bank-accounts'
              ? 'bg-[#1565c0] text-white border-[#1565c0] font-semibold'
              : 'bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/70'
          }`}
        >
          Quản lý ngân hàng
        </button>
      </div>

      {activeTab === 'bank-accounts' && (
        <BankAccountsTab
          bankAccounts={bankAccounts}
          setBankAccounts={setBankAccounts}
        />
      )}

      {(activeTab === 'cash' || activeTab === 'bank') && (
        <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
          Tab{' '}
          <strong>
            {activeTab === 'cash' ? 'Sổ chi tiết tiền mặt' : 'Sổ tiền gửi ngân hàng'}
          </strong>{' '}
          sẽ được triển khai chi tiết trong <strong>Giai đoạn 3 (Prompt 3.1)</strong>.
        </div>
      )}
    </div>
  );
}