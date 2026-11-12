// src/lib/excel/excel-helper.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExcelColumnRule {
  key: string;
  header: string; // Tiêu đề cột trên dòng 1 của Sheet dữ liệu
  width?: number;
  required?: boolean;
  type?: 'string' | 'number' | 'date'; // date dạng DD/MM/YYYY
  minNumber?: number;
  dropdownOptions?: readonly string[] | string[]; // Nếu có sẽ tự tạo قائمة thả xuống từ sheet _dropdown_data
}

export interface ExcelTemplateConfig {
  fileName: string; // VD: 'mau-them-nhieu-doanh-thu.xlsx'
  dataSheetName: string; // VD: 'Danh sách doanh thu' hoặc 'Template'
  includeDropdownSheet?: boolean; // true nếu có cột dropdown
  guideTitle: string; // VD: 'HƯỚNG DẪN NHẬP DOANH THU'
  guideLines: string[]; // Danh sách các dòng hướng dẫn
  columns: ExcelColumnRule[];
}

export interface ParsedExcelResult<T = Record<string, any>> {
  rows: T[];
  errors: string[];
}

// Chuyển đổi chỉ số cột (1-based) sang ký tự cột Excel (1 -> A, 2 -> B, ...)
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

/**
 * Tạo và tải xuống file mẫu Excel chuẩn (2 hoặc 3 sheets: Data, _dropdown_data, Hướng dẫn nhập)
 */
export async function downloadExcelTemplate(config: ExcelTemplateConfig): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FDI HKD Accounting Pro';
  workbook.created = new Date();

  // 1. Tạo Sheet 1: Sheet nhập dữ liệu chính
  const dataSheet = workbook.addWorksheet(config.dataSheetName);
  dataSheet.columns = config.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 24,
  }));

  // Định dạng dòng tiêu đề 1
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  // 2. Tạo Sheet 2: _dropdown_data (Nếu có cột chứa dropdownOptions)
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

      // Ghi danh sách giá trị vào cột tương ứng trên sheet _dropdown_data (từ dòng 1 đến N)
      options.forEach((optValue, rowIdx) => {
        dropdownSheet.getCell(rowIdx + 1, dColIndex).value = optValue;
      });

      // Gắn Data Validation (Dropdown) cho 500 dòng đầu tiên trên Sheet 1
      const targetColLetter = getExcelColumnLetter(col.colIndex);
      const formulaRange = `'_dropdown_data'!$${dColLetter}$1:$${dColLetter}$${options.length}`;

      for (let r = 2; r <= 500; r++) {
        dataSheet.getCell(`${targetColLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: !col.required,
          formulae: [formulaRange],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: `Vui lòng chọn một giá trị trong danh sách thả xuống của cột "${col.header}".`,
        };
      }
    });
  }

  // 3. Tạo Sheet 3: Hướng dẫn nhập
  const guideSheet = workbook.addWorksheet('Hướng dẫn nhập');
  guideSheet.getColumn(1).width = 100;

  const titleCell = guideSheet.getCell('A1');
  titleCell.value = config.guideTitle;
  titleCell.font = { bold: true, size: 12, color: { argb: 'FF0D47A1' } };

  config.guideLines.forEach((line, index) => {
    const cell = guideSheet.getCell(`A${index + 2}`);
    cell.value = line;
    cell.font = { size: 11 };
  });

  // Xuất file ra trình duyệt
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, config.fileName);
}

/**
 * Chuẩn hóa chuỗi ngày tháng về định dạng DD/MM/YYYY
 */
function normalizeDateValue(rawVal: any): string {
  if (!rawVal) return '';
  if (rawVal instanceof Date) {
    const dd = String(rawVal.getDate()).padStart(2, '0');
    const mm = String(rawVal.getMonth() + 1).padStart(2, '0');
    const yyyy = rawVal.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const str = String(rawVal).trim();
  // Nếu đã ở dạng DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  // Nếu ở dạng YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
}

/**
 * Đọc và kiểm tra Validation dữ liệu từ file Excel người dùng chọn để đổ vào MultiRowModal
 */
export async function parseExcelFile<T = Record<string, any>>(
  file: File,
  config: ExcelTemplateConfig
): Promise<ParsedExcelResult<T>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Ưu tiên tìm đúng tên sheet cấu hình, nếu không thấy lấy sheet đầu tiên
  const worksheet =
    workbook.getWorksheet(config.dataSheetName) || workbook.worksheets[0];

  if (!worksheet) {
    return { rows: [], errors: ['Không tìm thấy sheet dữ liệu hợp lệ trong file Excel.'] };
  }

  const rows: T[] = [];
  const errors: string[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Bỏ qua dòng tiêu đề 1
    if (rowNumber === 1) return;

    const rowData: Record<string, any> = {};
    let isRowCompletelyEmpty = true;

    config.columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      // Xử lý trường hợp cell là công thức hoặc richText
      let rawVal: any = cell.value;
      if (rawVal && typeof rawVal === 'object') {
        if ('result' in rawVal) {
          rawVal = rawVal.result;
        } else if ('richText' in rawVal && Array.isArray(rawVal.richText)) {
          rawVal = rawVal.richText.map((t: any) => t.text).join('');
        } else if ('text' in rawVal) {
          rawVal = rawVal.text;
        }
      }

      if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
        isRowCompletelyEmpty = false;
      }

      if (col.type === 'date') {
        const formattedDate = normalizeDateValue(rawVal);
        rowData[col.key] = formattedDate;
        if (col.required && !formattedDate) {
          errors.push(`Dòng ${rowNumber}: Cột "${col.header}" là bắt buộc.`);
        } else if (formattedDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(formattedDate)) {
          errors.push(
            `Dòng ${rowNumber}: Cột "${col.header}" (${formattedDate}) không đúng định dạng DD/MM/YYYY.`
          );
        }
      } else if (col.type === 'number') {
        if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
          rowData[col.key] = 0;
          if (col.required) {
            errors.push(`Dòng ${rowNumber}: Cột "${col.header}" là bắt buộc.`);
          }
        } else {
          const cleaned = String(rawVal).replace(/,/g, '').trim();
          const num = Number(cleaned);
          if (isNaN(num)) {
            errors.push(`Dòng ${rowNumber}: Cột "${col.header}" chỉ được nhập số.`);
            rowData[col.key] = 0;
          } else {
            if (col.minNumber !== undefined && num < col.minNumber) {
              errors.push(
                `Dòng ${rowNumber}: Cột "${col.header}" phải lớn hơn hoặc bằng ${col.minNumber}.`
              );
            }
            rowData[col.key] = num;
          }
        }
      } else {
        const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
        rowData[col.key] = strVal;
        if (col.required && !strVal) {
          errors.push(`Dòng ${rowNumber}: Cột "${col.header}" không được để trống.`);
        }
      }
    });

    if (!isRowCompletelyEmpty) {
      rows.push(rowData as T);
    }
  });

  return { rows, errors };
}