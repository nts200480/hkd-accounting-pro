// src/lib/excel/excel-importer.ts
import ExcelJS from 'exceljs';
import { ExcelTemplateConfig } from './excel-templates';

export interface ParsedExcelResult<T = Record<string, any>> {
  rows: T[];
  errors: string[];
}

function extractCellValue(cellValue: any): any {
  if (cellValue && typeof cellValue === 'object') {
    if (cellValue instanceof Date) return cellValue;
    if ('result' in cellValue) return cellValue.result;
    if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((t: any) => t.text).join('');
    }
    if ('text' in cellValue) return cellValue.text;
  }
  return cellValue;
}

function normalizeDateValue(rawVal: any): string {
  if (!rawVal) return '';
  if (rawVal instanceof Date) {
    const dd = String(rawVal.getDate()).padStart(2, '0');
    const mm = String(rawVal.getMonth() + 1).padStart(2, '0');
    const yyyy = rawVal.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const str = String(rawVal).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
}

/**
 * Đọc file Excel thông minh:
 * - Hỗ trợ cả File Mẫu Import chuẩn (Header ở dòng 1, không có cột STT)
 * - Hỗ trợ luôn cả trường hợp người dùng lấy File Xuất Excel (Header ở dòng 4 hoặc 5, có cột STT ở cột A) để Import lại
 */
export async function parseExcelFile<T = Record<string, any>>(
  file: File,
  config: ExcelTemplateConfig
): Promise<ParsedExcelResult<T>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet =
    workbook.getWorksheet(config.dataSheetName) || workbook.worksheets[0];

  if (!worksheet) {
    return { rows: [], errors: ['Không tìm thấy sheet dữ liệu hợp lệ trong file Excel.'] };
  }

  const rows: T[] = [];
  const errors: string[] = [];

  // 1. Tự động dò tìm dòng Header thực sự (quét từ dòng 1 đến dòng 10)
  //    và kiểm tra xem cột A có phải là cột "STT" (do dùng file Xuất Excel) hay không
  let headerRowNumber = 1;
  let colOffset = 0; // Nếu cột A là 'STT' mà trong config không có 'STT', dịch sang phải 1 cột

  const firstConfigHeader = config.columns[0]?.header.toLowerCase().trim() || '';

  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const cellA = String(extractCellValue(row.getCell(1).value) || '')
      .toLowerCase()
      .trim();
    const cellB = String(extractCellValue(row.getCell(2).value) || '')
      .toLowerCase()
      .trim();

    // Trường hợp 1: File Mẫu Import chuẩn (Cột A khớp với cột đầu tiên trong config)
    if (cellA && (cellA === firstConfigHeader || firstConfigHeader.includes(cellA))) {
      headerRowNumber = r;
      colOffset = 0;
      break;
    }

    // Trường hợp 2: Người dùng chọn File Xuất Excel (Cột A là 'STT', Cột B là 'Tên' / 'Tên đối tác' / 'Mã hàng'...)
    if (cellA === 'stt' && cellB) {
      headerRowNumber = r;
      colOffset = 1; // Bỏ qua cột A (STT), đọc dữ liệu từ cột B trở đi
      break;
    }
  }

  // 2. Đọc dữ liệu từ dòng ngay sau dòng Header
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    // Bỏ qua các dòng tổng cộng cuối bảng nếu người dùng lấy file báo cáo để import
    const firstCellText = String(extractCellValue(row.getCell(1).value) || '')
      .toLowerCase()
      .trim();
    const secondCellText = String(extractCellValue(row.getCell(1 + colOffset).value) || '')
      .toLowerCase()
      .trim();

    if (
      firstCellText.startsWith('cộng số phát sinh') ||
      firstCellText.startsWith('tổng cộng') ||
      firstCellText.startsWith('số dư') ||
      secondCellText.startsWith('cộng số phát sinh') ||
      secondCellText.startsWith('tổng cộng') ||
      secondCellText.startsWith('số dư')
    ) {
      return;
    }

    const rowData: Record<string, any> = {};
    let isRowCompletelyEmpty = true;

    config.columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1 + colOffset);
      const rawVal = extractCellValue(cell.value);

      if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
        isRowCompletelyEmpty = false;
      }

      if (col.type === 'date') {
        const formattedDate = normalizeDateValue(rawVal);
        rowData[col.key] = formattedDate;
        if (!isRowCompletelyEmpty) {
          if (col.required && !formattedDate) {
            errors.push(`Dòng ${rowNumber}: Cột "${col.header}" là bắt buộc.`);
          } else if (formattedDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(formattedDate)) {
            errors.push(
              `Dòng ${rowNumber}: Cột "${col.header}" (${formattedDate}) không đúng định dạng DD/MM/YYYY.`
            );
          }
        }
      } else if (col.type === 'number') {
        if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
          rowData[col.key] = 0;
          if (!isRowCompletelyEmpty && col.required) {
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
                `Dòng ${rowNumber}: Cột "${col.header}" phải >= ${col.minNumber}.`
              );
            }
            rowData[col.key] = num;
          }
        }
      } else {
        const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
        rowData[col.key] = strVal;
      }
    });

    // Chỉ kiểm tra trường bắt buộc và thêm vào danh sách nếu dòng đó thực sự có dữ liệu
    // (Tránh lỗi khi file Xuất Excel có 20 dòng đánh sẵn STT từ 1->20 nhưng các cột thông tin để trống)
    const hasMeaningfulData = Object.values(rowData).some(
      (v) => v !== '' && v !== 0 && v !== null && v !== undefined
    );

    if (!isRowCompletelyEmpty && hasMeaningfulData) {
      config.columns.forEach((col) => {
        if (col.required && col.type !== 'date' && col.type !== 'number') {
          if (!rowData[col.key] || String(rowData[col.key]).trim() === '') {
            errors.push(`Dòng ${rowNumber}: Cột "${col.header}" không được để trống.`);
          }
        }
      });
      rows.push(rowData as T);
    }
  });

  return { rows, errors };
}