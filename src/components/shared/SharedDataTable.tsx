// src/components/shared/SharedDataTable.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  Columns,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';

export interface TableColumnDef<T> {
  key: string;
  header: string;
  /** Nếu có groupHeader, các cột liền kề có cùng groupHeader sẽ được gộp ở dòng Header tầng 1 */
  groupHeader?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  filterOptions?: readonly string[] | string[]; // Nếu có sẽ hiển thị select khi lọc cột, nếu không hiển thị ô text
  stickyRight?: boolean;
  accessor?: (row: T, index: number) => any;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface SummaryRowDef {
  label: string; // VD: 'Số dư đầu kỳ', 'Cộng số phát sinh', 'Tổng cộng'
  labelColumnKey: string; // Cột bắt đầu hiển thị nhãn (VD: 'description' hoặc 'collected_amount')
  values: Record<string, React.ReactNode>; // Map từ column.key -> giá trị tổng hiển thị
  position?: 'top' | 'bottom'; // 'top' dùng cho Số dư đầu kỳ (Sổ tiền/Công nợ), mặc định 'bottom'
}

export interface SharedDataTableProps<T> {
  columns: TableColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showIndexColumn?: boolean;
  searchPlaceholder?: string;
  searchableKeys?: string[];
  /** Bộ lọc ngày chứng từ tùy chọn đặt cạnh ô tìm kiếm */
  dateFilterNode?: React.ReactNode;
  summaryRows?: SummaryRowDef[];
  emptyMessage?: string;
  defaultPageSize?: number;
}

export function SharedDataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  selectable = true,
  selectedIds = [],
  onSelectionChange,
  showIndexColumn = true,
  searchPlaceholder = 'Tìm kiếm...',
  searchableKeys = [],
  dateFilterNode,
  summaryRows = [],
  emptyMessage = 'Không có dữ liệu',
  defaultPageSize = 20,
}: SharedDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  );
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.includes(col.key)),
    [columns, hiddenColumns]
  );

  // Kiểm tra xem bảng có sử dụng Header 2 tầng (groupHeader) hay không
  const hasGroupHeaders = useMemo(
    () => visibleColumns.some((col) => Boolean(col.groupHeader)),
    [visibleColumns]
  );

  // Xử lý giá trị thực của 1 ô để phục vụ tìm kiếm, lọc và sắp xếp
  const getCellValue = (row: T, col: TableColumnDef<T>, idx: number): any => {
    if (col.accessor) return col.accessor(row, idx);
    return row[col.key];
  };

  // 1. Lọc theo ô tìm kiếm nhanh & bộ lọc từng cột
  const filteredData = useMemo(() => {
    return data.filter((row, idx) => {
      // Tìm kiếm tổng quát
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const keysToSearch =
          searchableKeys.length > 0 ? searchableKeys : visibleColumns.map((c) => c.key);

        const matchesSearch = keysToSearch.some((k) => {
          const val = row[k];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        });
        if (!matchesSearch) return false;
      }

      // Lọc theo từng cột
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal || filterVal.trim() === '') continue;
        const colDef = columns.find((c) => c.key === colKey);
        const cellVal = colDef ? getCellValue(row, colDef, idx) : row[colKey];
        const cellStr = cellVal !== null && cellVal !== undefined ? String(cellVal).toLowerCase() : '';
        if (!cellStr.includes(filterVal.toLowerCase().trim())) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, searchableKeys, visibleColumns, columnFilters, columns]);

  // 2. Sắp xếp dữ liệu
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    const colDef = columns.find((c) => c.key === sortConfig.key);
    if (!colDef) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = getCellValue(a, colDef, 0);
      const valB = getCellValue(b, colDef, 0);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortConfig.direction === 'asc'
        ? strA.localeCompare(strB, 'vi')
        : strB.localeCompare(strA, 'vi');
    });
  }, [filteredData, sortConfig, columns]);

  // 3. Phân trang
  const totalRecords = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, safeCurrentPage, pageSize]);

  // Xử lý chọn tất cả dòng trên trang hiện tại
  const allCurrentPageSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedIds.includes(rowKey(row)));

  const handleToggleSelectAll = () => {
    if (!onSelectionChange) return;
    const currentPageIds = paginatedData.map((r) => rowKey(r));
    if (allCurrentPageSelected) {
      onSelectionChange(selectedIds.filter((id) => !currentPageIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...currentPageIds]));
      onSelectionChange(merged);
    }
  };

  const handleToggleRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (colKey: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== colKey) return { key: colKey, direction: 'asc' };
      if (prev.direction === 'asc') return { key: colKey, direction: 'desc' };
      return null;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setColumnFilters({});
    setSortConfig(null);
    setActiveFilterKey(null);
    setCurrentPage(1);
  };

  const topSummaryRows = summaryRows.filter((r) => r.position === 'top');
  const bottomSummaryRows = summaryRows.filter((r) => r.position !== 'top');

  // Tính toán cấu trúc Header tầng 1 và tầng 2 nếu có groupHeader
  const headerGroups = useMemo(() => {
    if (!hasGroupHeaders) return [];
    const groups: Array<
      | { type: 'single'; col: TableColumnDef<T> }
      | { type: 'group'; title: string; cols: TableColumnDef<T>[] }
    > = [];

    visibleColumns.forEach((col) => {
      if (!col.groupHeader) {
        groups.push({ type: 'single', col });
      } else {
        const last = groups[groups.length - 1];
        if (last && last.type === 'group' && last.title === col.groupHeader) {
          last.cols.push(col);
        } else {
          groups.push({ type: 'group', title: col.groupHeader, cols: [col] });
        }
      }
    });
    return groups;
  }, [hasGroupHeaders, visibleColumns]);

  const renderColumnHeaderContent = (col: TableColumnDef<T>) => {
    const isSorted = sortConfig?.key === col.key;
    const hasFilter = Boolean(columnFilters[col.key]);

    return (
      <div className="relative flex items-center justify-between gap-1 select-none">
        <span className="font-semibold text-slate-700 leading-tight">{col.header}</span>
        <div className="flex items-center space-x-0.5 shrink-0">
          {col.sortable && (
            <button
              type="button"
              onClick={() => handleSort(col.key)}
              className={`p-0.5 rounded hover:bg-slate-200 ${
                isSorted ? 'text-blue-600' : 'text-slate-400'
              }`}
              title="Sắp xếp"
            >
              {isSorted ? (
                sortConfig?.direction === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {col.filterable && (
            <button
              type="button"
              onClick={() =>
                setActiveFilterKey((prev) => (prev === col.key ? null : col.key))
              }
              className={`p-0.5 rounded hover:bg-slate-200 ${
                hasFilter ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
              title="Lọc cột này"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Popup lọc trực tiếp trên cột */}
        {activeFilterKey === col.key && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg p-2 z-30 font-normal">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-600">
                Lọc: {col.header}
              </span>
              <button
                type="button"
                onClick={() => setActiveFilterKey(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {col.filterOptions && col.filterOptions.length > 0 ? (
              <select
                value={columnFilters[col.key] || ''}
                onChange={(e) => {
                  setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Tất cả --</option>
                {col.filterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Nhập từ khóa lọc..."
                value={columnFilters[col.key] || ''}
                onChange={(e) => {
                  setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            )}
            <div className="flex justify-end mt-2 space-x-1">
              <button
                type="button"
                onClick={() => {
                  setColumnFilters((prev) => ({ ...prev, [col.key]: '' }));
                  setActiveFilterKey(null);
                }}
                className="text-[11px] px-2 py-0.5 text-slate-600 hover:bg-slate-100 rounded"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterKey(null)}
                className="text-[11px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSummaryRow = (sRow: SummaryRowDef, idx: number) => {
    const labelColIndex = visibleColumns.findIndex((c) => c.key === sRow.labelColumnKey);
    const effectiveLabelIdx = labelColIndex >= 0 ? labelColIndex : 0;
    const prefixColSpan =
      (selectable ? 1 : 0) + (showIndexColumn ? 1 : 0) + effectiveLabelIdx;

    return (
      <tr
        key={`summary-${sRow.label}-${idx}`}
        className="bg-slate-50/90 font-semibold text-slate-800 border-t border-b border-slate-200"
      >
        {prefixColSpan > 0 && <td colSpan={prefixColSpan} className="px-3 py-2" />}
        <td className="px-3 py-2 whitespace-nowrap text-slate-900">{sRow.label}</td>
        {visibleColumns.slice(effectiveLabelIdx + 1).map((col) => (
          <td
            key={`sum-cell-${col.key}`}
            className={`px-3 py-2 whitespace-nowrap ${
              col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                ? 'text-center'
                : 'text-left'
            }`}
          >
            {sRow.values[col.key] !== undefined ? sRow.values[col.key] : ''}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded shadow-2xs flex flex-col">
      {/* Thanh công cụ tìm kiếm & Xóa bộ lọc phía trên bảng */}
      <div className="p-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200 transition"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Xóa bộ lọc</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {dateFilterNode}

          {/* Ô tìm kiếm nhanh */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Nút bật/tắt hiển thị cột */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnToggle((prev) => !prev)}
              className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"
              title="Tùy chỉnh cột hiển thị"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            {showColumnToggle && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg p-2 z-30 max-h-64 overflow-y-auto">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5 px-1">
                  Hiển thị cột
                </div>
                {columns.map((col) => {
                  const checked = !hiddenColumns.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      className="flex items-center space-x-2 px-1 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setHiddenColumns((prev) =>
                            checked ? [...prev, col.key] : prev.filter((k) => k !== col.key)
                          );
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate">{col.header}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Khung bảng có thanh cuộn ngang */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-[#f8fafc] border-b border-slate-200">
            {!hasGroupHeaders ? (
              <tr>
                {selectable && (
                  <th className="w-9 px-3 py-2.5 text-center border-r border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                )}
                {showIndexColumn && (
                  <th className="w-12 px-2.5 py-2.5 text-center font-semibold text-slate-700 border-r border-slate-200/60">
                    STT
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ minWidth: col.width }}
                    className={`px-3 py-2.5 border-r border-slate-200/60 ${
                      col.stickyRight
                        ? 'sticky right-0 bg-[#f8fafc] z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]'
                        : ''
                    }`}
                  >
                    {renderColumnHeaderContent(col)}
                  </th>
                ))}
              </tr>
            ) : (
              <>
                {/* Dòng Header tầng 1 (Có gộp cột) */}
                <tr>
                  {selectable && (
                    <th
                      rowSpan={2}
                      className="w-9 px-3 py-2 text-center border-r border-b border-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                    </th>
                  )}
                  {showIndexColumn && (
                    <th
                      rowSpan={2}
                      className="w-12 px-2.5 py-2 text-center font-semibold text-slate-700 border-r border-b border-slate-200"
                    >
                      STT
                    </th>
                  )}
                  {headerGroups.map((grp, gIdx) => {
                    if (grp.type === 'single') {
                      const col = grp.col;
                      return (
                        <th
                          key={col.key}
                          rowSpan={2}
                          style={{ minWidth: col.width }}
                          className={`px-3 py-2 border-r border-b border-slate-200 ${
                            col.stickyRight ? 'sticky right-0 bg-[#f8fafc] z-10' : ''
                          }`}
                        >
                          {renderColumnHeaderContent(col)}
                        </th>
                      );
                    }
                    return (
                      <th
                        key={`grp-${grp.title}-${gIdx}`}
                        colSpan={grp.cols.length}
                        className="px-3 py-1.5 text-center font-semibold text-slate-700 border-r border-b border-slate-200 bg-slate-100/70"
                      >
                        {grp.title}
                      </th>
                    );
                  })}
                </tr>
                {/* Dòng Header tầng 2 (Các cột con của nhóm gộp) */}
                <tr>
                  {headerGroups.map((grp) => {
                    if (grp.type === 'single') return null;
                    return grp.cols.map((col) => (
                      <th
                        key={col.key}
                        style={{ minWidth: col.width }}
                        className="px-3 py-2 border-r border-b border-slate-200"
                      >
                        {renderColumnHeaderContent(col)}
                      </th>
                    ));
                  })}
                </tr>
              </>
            )}
          </thead>

          <tbody className="divide-y divide-slate-200">
            {/* Dòng tổng cố định đầu bảng (VD: Số dư đầu kỳ) */}
            {topSummaryRows.map((sRow, idx) => renderSummaryRow(sRow, idx))}

            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    visibleColumns.length + (selectable ? 1 : 0) + (showIndexColumn ? 1 : 0)
                  }
                  className="px-4 py-8 text-left text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const id = rowKey(row);
                const isSelected = selectedIds.includes(id);
                const stt = (safeCurrentPage - 1) * pageSize + rowIdx + 1;

                return (
                  <tr
                    key={id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'bg-white'
                    }`}
                  >
                    {selectable && (
                      <td className="px-3 py-2 text-center border-r border-slate-100">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(id)}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                    )}
                    {showIndexColumn && (
                      <td className="px-2.5 py-2 text-center text-slate-600 border-r border-slate-100">
                        {stt}
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 border-r border-slate-100 ${
                          col.align === 'right'
                            ? 'text-right font-medium'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${
                          col.stickyRight
                            ? 'sticky right-0 bg-white z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]'
                            : ''
                        }`}
                      >
                        {col.render
                          ? col.render(row, stt - 1)
                          : getCellValue(row, col, stt - 1) ?? '-'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}

            {/* Dòng tổng cố định cuối bảng (VD: Cộng số phát sinh, Tổng cộng, Số dư cuối kỳ) */}
            {bottomSummaryRows.map((sRow, idx) => renderSummaryRow(sRow, idx))}
          </tbody>
        </table>
      </div>

      {/* Thanh phân trang cuối bảng */}
      <div className="px-3 py-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/50">
        <div>
          {totalRecords > 0 ? (
            <span>
              {(safeCurrentPage - 1) * pageSize + 1} -{' '}
              {Math.min(safeCurrentPage * pageSize, totalRecords)} trong {totalRecords} bản ghi
            </span>
          ) : (
            <span>0 bản ghi</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 py-0.5 border border-blue-500 bg-blue-50 text-blue-600 font-semibold rounded">
              {safeCurrentPage}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-xs focus:outline-none"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}