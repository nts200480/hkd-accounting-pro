// src/components/shared/MultiRowModal.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
} from 'lucide-react';
import {
  downloadExcelTemplate,
  parseExcelFile,
  ExcelTemplateConfig,
} from '@/lib/excel/excel-helper';
import { formatVND } from '@/constants/hkd-constants';

export interface SelectOptionItem {
  value: string;
  label: string;
}

export interface ModalFieldColumn<T> {
  key: keyof T & string;
  header: string;
  width?: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'computed-currency';
  placeholder?: string;
  required?: boolean;
  options?: readonly string[] | string[] | SelectOptionItem[];
  /** Cho phép tự động cập nhật các trường khác trong cùng dòng khi trường này thay đổi (VD: chọn Hàng hóa -> tự nhảy Đơn vị & Loại thuế; nhập SL * Đơn giá -> tự tính Số tiền) */
  onValueChange?: (newValue: any, currentRow: T) => Partial<T>;
}

export interface BulkActionConfig<T> {
  label: string; // VD: 'Chọn loại chi phí hàng loạt' hoặc 'Đánh dấu sàn TMĐT hàng loạt'
  targetField: keyof T & string;
  options?: readonly string[] | string[]; // Nếu có options -> hiện menu chọn, nếu không -> gán boolean true/toggle
}

export interface MultiRowModalProps<T extends Record<string, any>> {
  isOpen: boolean;
  onClose: () => void;
  title: string; // VD: 'Thêm nhiều doanh thu', 'Thêm nhiều đối tác'
  infoBannerText?: string; // VD: 'Phiếu xuất kho tương tự sẽ được tạo nếu doanh thu được tạo mới có hàng hóa, số lượng và đơn giá.'
  columns: ModalFieldColumn<T>[];
  defaultRowFactory: () => T;
  excelConfig?: ExcelTemplateConfig;
  bulkActions?: BulkActionConfig<T>[];
  /** Hàm ánh xạ dữ liệu đọc từ Excel sang cấu trúc dòng của Modal (nếu cần xử lý thêm) */
  mapImportedRow?: (rawExcelRow: Record<string, any>) => T;
  /** Hàm kiểm tra nghiệp vụ tùy chỉnh trước khi lưu (VD: Sổ tiền chỉ được nhập Thu hoặc Chi) */
  customRowValidator?: (row: T, rowIndex: number) => string | null;
  onSubmitAll: (rows: T[]) => Promise<void> | void;
}

export function MultiRowModal<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  infoBannerText,
  columns,
  defaultRowFactory,
  excelConfig,
  bulkActions = [],
  mapImportedRow,
  customRowValidator,
  onSubmitAll,
}: MultiRowModalProps<T>) {
  const [rows, setRows] = useState<Array<T & { _rowId: string }>>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [activeBulkMenu, setActiveBulkMenu] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const createRowWithId = (base?: T): T & { _rowId: string } => ({
    ...(base || defaultRowFactory()),
    _rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });

  // Khởi tạo mặc định 1 dòng trống khi mở Popup
  useEffect(() => {
    if (isOpen) {
      setRows([createRowWithId()]);
      setSelectedRowIds([]);
      setValidationErrors([]);
      setCurrentPage(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const currentRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRowWithId()]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      const filtered = prev.filter((r) => r._rowId !== rowId);
      return filtered.length > 0 ? filtered : [createRowWithId()];
    });
    setSelectedRowIds((prev) => prev.filter((id) => id !== rowId));
  };

  const handleFieldChange = (
    rowId: string,
    col: ModalFieldColumn<T>,
    rawValue: any
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row._rowId !== rowId) return row;
        const updatedRow: T & { _rowId: string } = {
          ...row,
          [col.key]: rawValue,
        };
        if (col.onValueChange) {
          const extraChanges = col.onValueChange(rawValue, updatedRow);
          Object.assign(updatedRow, extraChanges);
        }
        return updatedRow;
      })
    );
  };

  // Áp dụng thao tác hàng loạt cho các dòng được tích chọn (hoặc toàn bộ dòng nếu chưa tích dòng nào)
  const handleApplyBulkAction = (targetField: keyof T & string, value: any) => {
    setRows((prev) =>
      prev.map((row) => {
        const shouldApply =
          selectedRowIds.length === 0 || selectedRowIds.includes(row._rowId);
        if (!shouldApply) return row;
        return { ...row, [targetField]: value };
      })
    );
    setActiveBulkMenu(null);
  };

  const handleDownloadTemplate = async () => {
    if (!excelConfig) return;
    await downloadExcelTemplate(excelConfig);
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excelConfig) return;

    const result = await parseExcelFile<Record<string, any>>(file, excelConfig);
    if (result.errors.length > 0) {
      setValidationErrors(result.errors);
    } else {
      setValidationErrors([]);
    }

    if (result.rows.length > 0) {
      const mapped = result.rows.map((raw) => {
        const base = mapImportedRow
          ? mapImportedRow(raw)
          : ({ ...defaultRowFactory(), ...raw } as T);
        return createRowWithId(base);
      });
      setRows(mapped);
      setCurrentPage(1);
    }

    // Reset input file để có thể chọn lại cùng 1 file nếu vừa sửa
    e.target.value = '';
  };

  const handleSaveAll = async () => {
    const errs: string[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      columns.forEach((col) => {
        if (col.required) {
          const val = row[col.key];
          if (val === null || val === undefined || String(val).trim() === '') {
            errs.push(`Dòng ${rowNum}: Trường "${col.header}" là bắt buộc.`);
          }
        }
      });

      if (customRowValidator) {
        const customErr = customRowValidator(row, idx);
        if (customErr) errs.push(customErr);
      }
    });

    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors([]);
      const cleanRows: T[] = rows.map(({ _rowId, ...rest }) => rest as unknown as T);
      await onSubmitAll(cleanRows);
      onClose();
    } catch (err: any) {
      setValidationErrors([err?.message || 'Có lỗi xảy ra khi lưu dữ liệu.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedRowIds.includes(r._rowId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-6xl flex flex-col max-h-[90vh]">
        {/* Header Popup */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>

          <div className="flex items-center space-x-2">
            {excelConfig && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tải mẫu Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Nhập Excel</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileSelected}
                  className="hidden"
                />
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nội dung chính của Popup */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {/* Dòng ghi chú nghiệp vụ màu xanh (Nếu có) */}
          {infoBannerText && (
            <div className="px-3.5 py-2 rounded bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
              {infoBannerText}
            </div>
          )}

          {/* Hiển thị lỗi kiểm tra dữ liệu (Validation Errors) */}
          {validationErrors.length > 0 && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 space-y-1 max-h-36 overflow-y-auto">
              <div className="font-semibold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Vui lòng kiểm tra lại các thông tin sau:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Cụm nút thao tác hàng loạt góc phải (VD: Chọn loại chi phí hàng loạt, Chọn loại thuế suất hàng loạt) */}
          {bulkActions.length > 0 && (
            <div className="flex justify-end items-center space-x-2">
              {bulkActions.map((action) => (
                <div key={action.label} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!action.options || action.options.length === 0) {
                        handleApplyBulkAction(action.targetField, true);
                      } else {
                        setActiveBulkMenu((prev) =>
                          prev === action.label ? null : action.label
                        );
                      }
                    }}
                    className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
                  >
                    {action.label}
                  </button>

                  {activeBulkMenu === action.label && action.options && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg py-1 z-30 max-h-60 overflow-y-auto">
                      {action.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleApplyBulkAction(action.targetField, opt)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bảng lưới nhập liệu có thanh cuộn ngang */}
          <div className="border border-slate-200 rounded overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="w-9 px-2.5 py-2 text-center border-r border-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) setSelectedRowIds([]);
                        else setSelectedRowIds(rows.map((r) => r._rowId));
                      }}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="w-11 px-2 py-2 text-center font-semibold border-r border-slate-200">
                    STT
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{ minWidth: col.width || '150px' }}
                      className="px-2.5 py-2 text-left font-semibold border-r border-slate-200 whitespace-nowrap"
                    >
                      {col.header}
                      {col.required && <span className="text-red-500 ml-0.5">*</span>}
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2 text-center sticky right-0 bg-slate-50 z-10" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {currentRows.map((row, idx) => {
                  const stt = (safePage - 1) * pageSize + idx + 1;
                  const isChecked = selectedRowIds.includes(row._rowId);

                  return (
                    <tr key={row._rowId} className="hover:bg-slate-50/70">
                      <td className="px-2.5 py-1.5 text-center border-r border-slate-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelectedRowIds((prev) =>
                              isChecked
                                ? prev.filter((id) => id !== row._rowId)
                                : [...prev, row._rowId]
                            )
                          }
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-100">
                        {stt}
                      </td>

                      {columns.map((col) => {
                        const val = row[col.key];

                        return (
                          <td
                            key={col.key}
                            className="px-2 py-1.5 border-r border-slate-100"
                          >
                            {col.type === 'select' ? (
                              <select
                                value={val ?? ''}
                                onChange={(e) =>
                                  handleFieldChange(row._rowId, col, e.target.value)
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-blue-500"
                              >
                                <option value="">
                                  {col.placeholder || `Chọn ${col.header.toLowerCase()}...`}
                                </option>
                                {(col.options || []).map((opt) => {
                                  const optVal =
                                    typeof opt === 'string' ? opt : opt.value;
                                  const optLabel =
                                    typeof opt === 'string' ? opt : opt.label;
                                  return (
                                    <option key={optVal} value={optVal}>
                                      {optLabel}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : col.type === 'number' ? (
                              <input
                                type="number"
                                value={val === 0 || val ? val : ''}
                                placeholder={col.placeholder || '0'}
                                onChange={(e) =>
                                  handleFieldChange(
                                    row._rowId,
                                    col,
                                    e.target.value === '' ? 0 : Number(e.target.value)
                                  )
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right focus:outline-none focus:border-blue-500"
                              />
                            ) : col.type === 'computed-currency' ? (
                              <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-50 rounded text-xs text-right font-medium text-slate-700">
                                {formatVND(Number(val || 0))} đ
                              </div>
                            ) : col.type === 'checkbox' ? (
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val)}
                                  onChange={(e) =>
                                    handleFieldChange(row._rowId, col, e.target.checked)
                                  }
                                  className="rounded border-slate-300 cursor-pointer"
                                />
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={val ?? ''}
                                placeholder={col.placeholder || ''}
                                onChange={(e) =>
                                  handleFieldChange(row._rowId, col, e.target.value)
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Cột Xóa dòng cố định bên phải */}
                      <td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row._rowId)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-200 transition"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Nút + Thêm dòng & Phân trang nội bộ trong Popup */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng</span>
            </button>

            <div className="flex items-center space-x-1.5 text-xs">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-0.5 border border-slate-300 rounded font-medium">
                {safePage}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded px-2 py-1 text-xs"
              >
                {[10, 20, 50, 100].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer Popup: Hủy & Thêm tất cả */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end space-x-2 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSaveAll}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Đang lưu...' : 'Thêm tất cả'}
          </button>
        </div>
      </div>
    </div>
  );
}