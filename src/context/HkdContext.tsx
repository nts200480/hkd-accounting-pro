// src/context/HkdContext.tsx
'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';

export interface HouseholdInfo {
  id: string;
  name: string;
  taxCode: string;
  address?: string;
  lockedPeriods: string[]; // VD: ['10/2026']
}

interface HkdContextValue {
  household: HouseholdInfo;
  setHousehold: React.Dispatch<React.SetStateAction<HouseholdInfo>>;
  period: string; // Định dạng MM/YYYY, VD: '11/2026'
  setPeriod: (period: string) => void;
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string; // YYYY-MM-DD
  isCurrentPeriodLocked: boolean;
  toggleLockCurrentPeriod: () => void;
}

const DEFAULT_HOUSEHOLD: HouseholdInfo = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'HKDPTDUY',
  taxCode: '052182012240',
  address: 'TP. Đà Nẵng, Việt Nam',
  lockedPeriods: [],
};

const HkdContext = createContext<HkdContextValue | undefined>(undefined);

export function HkdProvider({ children }: { children: React.ReactNode }) {
  const [household, setHousehold] = useState<HouseholdInfo>(DEFAULT_HOUSEHOLD);
  const [period, setPeriod] = useState<string>('11/2026');

  const { periodStartDate, periodEndDate } = useMemo(() => {
    const [mmStr, yyyyStr] = period.split('/');
    const month = parseInt(mmStr || '11', 10);
    const year = parseInt(yyyyStr || '2026', 10);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { periodStartDate: startDate, periodEndDate: endDate };
  }, [period]);

  const isCurrentPeriodLocked = useMemo(() => {
    return household.lockedPeriods.includes(period);
  }, [household.lockedPeriods, period]);

  const toggleLockCurrentPeriod = () => {
    setHousehold((prev) => {
      const exists = prev.lockedPeriods.includes(period);
      const updated = exists
        ? prev.lockedPeriods.filter((p) => p !== period)
        : [...prev.lockedPeriods, period];
      return { ...prev, lockedPeriods: updated };
    });
  };

  return (
    <HkdContext.Provider
      value={{
        household,
        setHousehold,
        period,
        setPeriod,
        periodStartDate,
        periodEndDate,
        isCurrentPeriodLocked,
        toggleLockCurrentPeriod,
      }}
    >
      {children}
    </HkdContext.Provider>
  );
}

export function useHkd() {
  const context = useContext(HkdContext);
  if (!context) {
    throw new Error('useHkd phải được sử dụng bên trong HkdProvider');
  }
  return context;
}