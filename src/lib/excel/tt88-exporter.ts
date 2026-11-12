// src/lib/excel/tt88-exporter.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Partner } from '@/types/database.types';
import { HouseholdInfo } from '@/context/HkdContext';

export async function exportPartnersToExcel(
  partners: Partner[],
  household: HouseholdInfo
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sach doi tac');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateDisplay = `${dd}/${mm}/${yyyy}`;
  const dateFile = `${dd}-${mm}-${yyyy}`;

  // Dòng 1: Tiêu đề bảng
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DANH SÁCH ĐỐI TÁC';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  // Dòng 2: Thông tin Hộ kinh doanh & MST
  sheet.mergeCells('A2:I2');
  const companyCell = sheet.getCell('A2');
  companyCell.value = `Công ty: ${household.name} - MST: ${household.taxCode}`;
  companyCell.font = { bold: true, size: 11 };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Dòng 3: Ngày xuất
  sheet.mergeCells('A3:I3');
  const dateCell = sheet.getCell('A3');
  dateCell.value = `Ngày xuất: ${dateDisplay}`;
  dateCell.font = { italic: true, size: 10 };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Dòng 4: Dòng trống
  sheet.getRow(4).values = [];

  // Dòng 5: Header 9 cột (A -> I)
  const headers = [
    'STT',
    'Tên',
    'Mã số thuế',
    'Loại đối tác',
    'Cài đặt loại chi phí',
    'Số tài khoản',
    'Người liên hệ',
    'Người đại diện pháp luật',
    'Địa chỉ',
  ];

  const headerRow = sheet.getRow(5);
  headerRow.values = headers;
  headerRow.font = { bold: true, size: 11 };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Độ rộng các cột A -> I
  const widths = [8, 34, 18, 20, 34, 20, 22, 24, 45];
  widths.forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });

  // Dòng 6 trở đi: Dữ liệu đối tác
  partners.forEach((p, idx) => {
    const row = sheet.getRow(6 + idx);
    row.values = [
      idx + 1,
      p.name || '',
      p.tax_code || '',
      p.partner_type || '',
      p.default_expense_type || '',
      p.bank_account_number || '',
      p.contact_person || '',
      p.legal_representative || '',
      p.address || '',
    ];

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'center' : 'left',
        wrapText: true,
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `File_danh_sach_doi_tac_${household.taxCode}_${dateFile}.xlsx`);
}