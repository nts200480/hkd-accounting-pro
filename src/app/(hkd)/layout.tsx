// src/app/(hkd)/layout.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Handshake,
  TrendingUp,
  Coins,
  Scale,
  Warehouse,
  Wallet,
  FileSpreadsheet,
  Building2,
  Bell,
  User,
  Settings,
  PlaySquare,
  Calendar,
  Lock,
} from 'lucide-react';
import { HKD_NAV_TABS, HkdNavTab } from '@/constants/hkd-constants';
import { HkdProvider, useHkd } from '@/context/HkdContext';

const ICON_MAP: Record<HkdNavTab['iconName'], React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  Handshake,
  TrendingUp,
  Coins,
  Scale,
  Warehouse,
  Wallet,
  FileSpreadsheet,
  Building2,
};

function HkdShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { household, period, setPeriod, isCurrentPeriodLocked } = useHkd();

  // Chuyển đổi giữa input type="month" (YYYY-MM) và định dạng hiển thị (MM/YYYY)
  const monthInputValue = React.useMemo(() => {
    const [mm, yyyy] = period.split('/');
    return `${yyyy}-${mm}`;
  }, [period]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM
    if (!val) return;
    const [yyyy, mm] = val.split('-');
    setPeriod(`${mm}/${yyyy}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-800 text-sm">
      {/* Tầng 1: Top System Header */}
      <header className="bg-white border-b border-slate-200 px-4 h-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xl tracking-tight text-[#0d47a1]">FDI</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase border-l border-slate-300 pl-2">
              HKD Accounting Pro
            </span>
          </div>

          {/* Menu phân hệ chính (Chỉ kích hoạt tab HKD) */}
          <div className="flex items-center space-x-1">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              <Building2 className="w-4 h-4" />
              <span>HKD</span>
            </div>
          </div>
        </div>

        {/* Cụm thông tin tài khoản HKD góc phải */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
          >
            <PlaySquare className="w-3.5 h-3.5" />
            <span>Giới thiệu tổng quan phần mềm</span>
          </button>

          {/* Bộ chọn Kỳ kinh doanh toàn cục */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">Kỳ:</span>
            <input
              type="month"
              value={monthInputValue}
              onChange={handleMonthChange}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
            {isCurrentPeriodLocked && (
              <span
                title="Kỳ này đã đóng sổ"
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"
              >
                <Lock className="w-3 h-3 mr-0.5" />
                Đã khóa
              </span>
            )}
          </div>

          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            title="Thông báo"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
            <User className="w-4 h-4 text-slate-600" />
            <div className="text-xs">
              <span className="font-semibold text-slate-800">{household.name}</span>
              <span className="text-slate-400 ml-1">({household.taxCode})</span>
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            title="Cài đặt"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tầng 2: Thanh điều hướng 9 Tab của Phân hệ HKD */}
      <nav className="bg-white border-b border-slate-200 px-4 overflow-x-auto sticky top-12 z-20 shadow-xs">
        <ul className="flex items-center space-x-1 min-w-max h-10">
          {HKD_NAV_TABS.map((tab) => {
            const Icon = ICON_MAP[tab.iconName];
            const isActive =
              pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));

            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50/40 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tầng 3: Nội dung chính của từng Tab */}
      <main className="flex-1 p-3 md:p-4 overflow-x-hidden">{children}</main>
    </div>
  );
}

export default function HkdLayout({ children }: { children: React.ReactNode }) {
  return (
    <HkdProvider>
      <HkdShell>{children}</HkdShell>
    </HkdProvider>
  );
}