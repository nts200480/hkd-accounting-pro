// src/lib/excel/excel-importer.ts
import ExcelJS from 'exceljs';
import { ExcelTemplateConfig } from './excel-templates';

export interface ParsedExcelResult<T = Record<string, any>> {
  rows: T[];
  errors: string[];
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
 * Đọc file Excel và kiểm tra dữ liệu theo cấu hình ExcelTemplateConfig
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

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowData: Record<string, any> = {};
    let isRowCompletelyEmpty = true;

    config.columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
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
                `Dòng ${rowNumber}: Cột "${col.header}" phải >= ${col.minNumber}.`
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