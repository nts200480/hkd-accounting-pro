// src/lib/excel/excel-templates.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PARTNER_TYPES, EXPENSE_TYPES, REVENUE_TYPES } from '@/constants/hkd-constants';

export interface ExcelColumnRule {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  type?: 'string' | 'number' | 'date';
  minNumber?: number;
  dropdownOptions?: readonly string[] | string[];
}

export interface ExcelTemplateConfig {
  fileName: string;
  dataSheetName: string;
  includeDropdownSheet?: boolean;
  guideTitle: string;
  guideLines: string[];
  columns: ExcelColumnRule[];
}

function getExcelColumnLetter(colIndex: number): string {
  let temp = 0;
  let letter = '';
  let col = colIndex;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

export async function downloadExcelTemplate(config: ExcelTemplateConfig): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FDI HKD Accounting Pro';
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet(config.dataSheetName);
  dataSheet.columns = config.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 24,
  }));

  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  const dropdownColumns = config.columns
    .map((col, idx) => ({ ...col, colIndex: idx + 1 }))
    .filter((col) => col.dropdownOptions && col.dropdownOptions.length > 0);

  if (config.includeDropdownSheet !== false && dropdownColumns.length > 0) {
    const dropdownSheet = workbook.addWorksheet('_dropdown_data');

    dropdownColumns.forEach((col, dIdx) => {
      const dColIndex = dIdx + 1;
      const dColLetter = getExcelColumnLetter(dColIndex);
      const options = col.dropdownOptions || [];

      dropdownSheet.getColumn(dColIndex).width = 50;

      options.forEach((optValue, rowIdx) => {
        dropdownSheet.getCell(rowIdx + 1, dColIndex).value = optValue;
      });

      const targetColLetter = getExcelColumnLetter(col.colIndex);
      const formulaRange = `'_dropdown_data'!$${dColLetter}$1:$${dColLetter}$${options.length}`;

      for (let r = 2; r <= 500; r++) {
        dataSheet.getCell(`${targetColLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: !col.required,
          formulae: [formulaRange],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: `Vui lòng chọn một giá trị trong danh sách thả xuống của cột "${col.header}".`, }; } }); }  const guideSheet = workbook.addWorksheet('Hướng dẫn nhập'); guideSheet.getColumn(1).width = 105;  const titleCell = guideSheet.getCell('A1'); titleCell.value = config.guideTitle; titleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };  config.guideLines.forEach((line, index) => { const cell = guideSheet.getCell(`A${index + 2}`);
    cell.value = line;
    cell.font = { size: 11 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, config.fileName);
}

export const PARTNER_EXCEL_TEMPLATE_CONFIG: ExcelTemplateConfig = {
  fileName: 'mau-them-nhieu-doi-tac.xlsx',
  dataSheetName: 'Danh sách đối tác',
  includeDropdownSheet: true,
  guideTitle: 'HƯỚNG DẪN NHẬP ĐỐI TÁC',
  guideLines: [
    '1. Nhập dữ liệu ở sheet Danh sách đối tác, bắt đầu từ dòng 2. Không đổi tên sheet, không sửa dòng tiêu đề 1.',
    '2. Tên đối tác: bắt buộc nhập.',
    '3. Mã số thuế: tùy chọn, nhập chuỗi mã số thuế hoặc CCCD của đối tác.',
    '4. Loại đối tác: chọn 1 trong 3 giá trị từ danh sách dropdown ở cột C (Khách hàng, Nhà cung cấp, Khách hàng & NCC).',
    '5. Cài đặt loại chi phí: tùy chọn, chọn 1 trong 7 giá trị từ danh sách dropdown ở cột D.',
    '6. Số tài khoản, Người liên hệ, Người đại diện pháp luật, Địa chỉ: tùy chọn.',
  ],
  columns: [
    { key: 'name', header: 'Tên đối tác', width: 32, required: true, type: 'string' },
    { key: 'tax_code', header: 'Mã số thuế', width: 18, required: false, type: 'string' },
    {
      key: 'partner_type',
      header: 'Loại đối tác',
      width: 22,
      required: false,
      type: 'string',
      dropdownOptions: PARTNER_TYPES,
    },
    {
      key: 'default_expense_type',
      header: 'Cài đặt loại chi phí',
      width: 38,
      required: false,
      type: 'string',
      dropdownOptions: EXPENSE_TYPES,
    },
    { key: 'bank_account_number', header: 'Số tài khoản', width: 20, required: false, type: 'string' },
    { key: 'contact_person', header: 'Người liên hệ', width: 22, required: false, type: 'string' },
    {
      key: 'legal_representative',
      header: 'Người đại diện pháp luật',
      width: 25,
      required: false,
      type: 'string',
    },
    { key: 'address', header: 'Địa chỉ', width: 42, required: false, type: 'string' },
  ],
};

export const PRODUCT_CATEGORIES = ['Hàng hóa', 'Dịch vụ', 'Thành phẩm', 'Nguyên vật liệu'] as const;

export const PRODUCT_EXCEL_TEMPLATE_CONFIG: ExcelTemplateConfig = {
  fileName: 'mau-them-nhieu-hang-hoa.xlsx',
  dataSheetName: 'Danh sách hàng hóa',
  includeDropdownSheet: true,
  guideTitle: 'HƯỚNG DẪN NHẬP HÀNG HÓA / DỊCH VỤ',
  guideLines: [
    '1. Nhập dữ liệu ở sheet Danh sách hàng hóa, bắt đầu từ dòng 2. Không đổi tên sheet, không sửa dòng tiêu đề 1.',
    '2. Mã hàng hóa: bắt buộc, viết liền không khoảng trắng (VD: HDPE, PET, PP, PVC).',
    '3. Mã HH theo HĐ: tùy chọn, mã ánh xạ với hóa đơn điện tử.',
    '4. Tên hàng hóa: bắt buộc nhập.',
    '5. Đơn vị tính: nhập tên đơn vị tính (VD: kg, cái, thùng).',
    '6. Phân loại: chọn trong danh sách dropdown (Hàng hóa, Dịch vụ, Thành phẩm, Nguyên vật liệu).',
    '7. Loại thuế suất bán ra: chọn 1 trong 8 mức thuế suất chuẩn từ dropdown ở cột F.',
    '8. Số lượng tồn đầu: tùy chọn, chỉ nhập số.',
  ],
  columns: [
    { key: 'code', header: 'Mã hàng hóa', width: 20, required: true, type: 'string' },
    { key: 'invoice_code', header: 'Mã HH theo HĐ', width: 20, required: false, type: 'string' },
    { key: 'name', header: 'Tên hàng hóa', width: 36, required: true, type: 'string' },
    { key: 'unit_name', header: 'Đơn vị tính', width: 16, required: false, type: 'string' },
    {
      key: 'category',
      header: 'Phân loại',
      width: 20,
      required: false,
      type: 'string',
      dropdownOptions: PRODUCT_CATEGORIES,
    },
    {
      key: 'default_revenue_type',
      header: 'Loại thuế suất bán ra',
      width: 48,
      required: false,
      type: 'string',
      dropdownOptions: REVENUE_TYPES,
    },
    { key: 'current_stock', header: 'Số lượng tồn', width: 18, required: false, type: 'number' },
  ],
};