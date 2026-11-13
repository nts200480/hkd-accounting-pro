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
 * Kiểm tra xem dòng hiện tại có phải là dòng tiêu đề báo cáo / dòng gộp ô (Merge Cells) hay không
 */
function isMetadataOrMergedTitleRow(row: ExcelJS.Row): boolean {
  const cell1 = row.getCell(1);
  const cell2 = row.getCell(2);

  const val1 = String(extractCellValue(cell1.value) || '').trim();
  const val2 = String(extractCellValue(cell2.value) || '').trim();
  const lower1 = val1.toLowerCase();

  // Nếu cột 1 trống hoàn toàn
  if (!val1 && !val2) return true;

  // Nếu dòng bị gộp ô ngang (A1:I1, A2:I2, A3:I3) -> ExcelJS trả về val1 === val2
  if (cell1.isMerged || (val1 !== '' && val1 === val2)) {
    return true;
  }

  // Chặn các từ khóa dòng tiêu đề báo cáo hoặc dòng tổng cuối bảng
  const metadataPrefixes = [
    'danh sách',
    'bảng kê',
    'tổng hợp',
    'chi tiết công nợ',
    'công ty:',
    'hộ kinh doanh:',
    'ngày xuất:',
    'kỳ:',
    'kỳ kê khai:',
    'cộng số phát sinh',
    'tổng cộng',
    'số dư đầu kỳ',
    'số dư cuối kỳ',
  ];

  if (metadataPrefixes.some((prefix) => lower1.startsWith(prefix))) {
    return true;
  }

  return false;
}

/**
 * Đọc file Excel và tự động loại bỏ phần tiêu đề báo cáo + cột STT
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

  // Bước 1: Quét 15 dòng đầu tiên để tìm chính xác dòng Header và xác định có cột STT ở cột A hay không
  let headerRowNumber = 1;
  let colOffset = 0;

  const firstConfigHeader = (config.columns[0]?.header || '').toLowerCase().trim();

  for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);

    // Bỏ qua ngay nếu là dòng tiêu đề gộp ô (DANH SÁCH ĐỐI TÁC, Công ty:..., Ngày xuất:...)
    if (isMetadataOrMergedTitleRow(row)) {
      continue;
    }

    const cellA = String(extractCellValue(row.getCell(1).value) || '')
      .toLowerCase()
      .trim();
    const cellB = String(extractCellValue(row.getCell(2).value) || '')
      .toLowerCase()
      .trim();

    // Trường hợp A: File xuất Excel có cột A là 'STT' (VD: dòng 5: STT | Tên | Mã số thuế...)
    if (cellA === 'stt' && cellB !== '') {
      headerRowNumber = r;
      colOffset = 1; // Dịch sang phải 1 cột để bỏ qua cột STT
      break;
    }

    // Trường hợp B: File mẫu Import chuẩn không có cột STT (VD: dòng 1: Tên đối tác | Mã số thuế...)
    if (
      cellA !== '' &&
      (cellA === firstConfigHeader ||
        firstConfigHeader.includes(cellA) ||
        cellA.includes(firstConfigHeader))
    ) {
      headerRowNumber = r;
      colOffset = 0;
      break;
    }
  }

  // Bước 2: Đọc dữ liệu từ dòng ngay sau dòng Header
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Bỏ qua toàn bộ các dòng từ dòng Header trở lên
    if (rowNumber <= headerRowNumber) return;

    // Bỏ qua nếu gặp dòng tiêu đề gộp hoặc dòng tổng cộng
    if (isMetadataOrMergedTitleRow(row)) return;

    const firstDataCell = String(
      extractCellValue(row.getCell(1 + colOffset).value) || ''
    )
      .toLowerCase()
      .trim();

    // Phòng hờ trường hợp có dòng Header lặp lại
    if (firstDataCell === 'tên' || firstDataCell === 'tên đối tác' || firstDataCell === 'stt') {
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

    // Chỉ lấy dòng có dữ liệu thực sự (bỏ qua các dòng chỉ đánh sẵn số STT nhưng thông tin trống)
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