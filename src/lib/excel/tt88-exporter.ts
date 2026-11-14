// src/lib/excel/tt88-exporter.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Partner, ProductItem, UnitItem, WarehouseItem } from '@/types/database.types';
import { HouseholdInfo } from '@/context/HkdContext';

function getTodayStrings() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return {
    dateDisplay: `${dd}/${mm}/${yyyy}`, dateFile: `${dd}-${mm}-${yyyy}`,
  };
}

export async function exportPartnersToExcel(
  partners: Partner[],
  household: HouseholdInfo
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sach doi tac');
  const { dateDisplay, dateFile } = getTodayStrings();

  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DANH SÁCH ĐỐI TÁC';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells('A2:I2');
  const companyCell = sheet.getCell('A2');
  companyCell.value = `Công ty: ${household.name} - MST:${household.taxCode}`;
  companyCell.font = { bold: true, size: 11 };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A3:I3');
  const dateCell = sheet.getCell('A3');
  dateCell.value = `Ngày xuất: ${dateDisplay}`; dateCell.font = { italic: true, size: 10 }; dateCell.alignment = { horizontal: 'center', vertical: 'middle' };  sheet.getRow(4).values = [];  const headers = [ 'STT', 'Tên', 'Mã số thuế', 'Loại đối tác', 'Cài đặt loại chi phí', 'Số tài khoản', 'Người liên hệ', 'Người đại diện pháp luật', 'Địa chỉ', ];  const headerRow = sheet.getRow(5); headerRow.values = headers; headerRow.font = { bold: true, size: 11 }; headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; headerRow.height = 26;  headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }, }; });  const widths = [8, 34, 18, 20, 34, 20, 22, 24, 45]; widths.forEach((w, idx) => { sheet.getColumn(idx + 1).width = w; });  partners.forEach((p, idx) => { const row = sheet.getRow(6 + idx); row.values = [ idx + 1, p.name \vert{}\vert{} '', p.tax_code \vert{}\vert{} '', p.partner_type \vert{}\vert{} '', p.default_expense_type \vert{}\vert{} '', p.bank_account_number \vert{}\vert{} '', p.contact_person \vert{}\vert{} '', p.legal_representative \vert{}\vert{} '', p.address \vert{}\vert{} '', ];  row.eachCell({ includeEmpty: true }, (cell, colNumber) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }, }; cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left', wrapText: true, }; }); });  const buffer = await workbook.xlsx.writeBuffer(); saveAs( new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', }), `File_danh_sach_doi_tac_${household.taxCode}_${dateFile}.xlsx` ); }  export async function exportProductsToExcel( products: ProductItem[], household: HouseholdInfo ): Promise<void> { const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Danh sach hang hoa'); const { dateDisplay, dateFile } = getTodayStrings();  sheet.mergeCells('A1:H1'); sheet.getCell('A1').value = 'DANH SÁCH HÀNG HÓA / DỊCH VỤ'; sheet.getCell('A1').font = { bold: true, size: 14 }; sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };  sheet.mergeCells('A2:H2'); sheet.getCell('A2').value = `Công ty: ${household.name} - MST: ${household.taxCode}`; sheet.getCell('A2').font = { bold: true, size: 11 }; sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };  sheet.mergeCells('A3:H3'); sheet.getCell('A3').value = `Ngày xuất: ${dateDisplay}`;
  sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = sheet.getRow(5);
  headerRow.values = [
    'STT',
    'Mã hàng hóa',
    'Mã HH theo HĐ',
    'Tên hàng hóa',
    'Đơn vị tính',
    'Phân loại',
    'Loại thuế suất bán ra',
    'Số lượng tồn',
  ];
  headerRow.font = { bold: true, size: 11 };
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const widths = [8, 20, 20, 42, 14, 18, 48, 18];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  products.forEach((item, idx) => {
    const row = sheet.getRow(6 + idx);
    row.values = [
      idx + 1,
      item.code,
      item.invoice_code || '',
      item.name,
      item.unit_name || '',
      item.category,
      item.default_revenue_type || '',
      Number(item.current_stock || 0),
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
        horizontal: colNumber === 1 ? 'center' : colNumber === 8 ? 'right' : 'left',
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `File_danh_sach_hang_hoa_${household.taxCode}_${dateFile}.xlsx`
  );
}

export async function exportUnitsToExcel(
  units: UnitItem[],
  household: HouseholdInfo
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Don vi hang hoa');
  const { dateFile } = getTodayStrings();

  const headerRow = sheet.getRow(1);
  headerRow.values = ['STT', 'Tên đơn vị hàng hóa', 'Độ ưu tiên sắp xếp', 'Diễn giải', 'Ngày tạo'];
  headerRow.font = { bold: true };
  const widths = [8, 28, 20, 35, 22];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  units.forEach((u, idx) => {
    sheet.addRow([idx + 1, u.name, u.sort_order, u.description || '', u.created_at || '']);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Don_vi_hang_hoa_${household.taxCode}_${dateFile}.xlsx`
  );
}

export async function exportWarehousesToExcel(
  warehouses: WarehouseItem[],
  household: HouseholdInfo
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nha kho');
  const { dateFile } = getTodayStrings();

  const headerRow = sheet.getRow(1);
  headerRow.values = ['STT', 'Tên nhà kho', 'Độ ưu tiên sắp xếp', 'Diễn giải', 'Mặc định'];
  headerRow.font = { bold: true };
  const widths = [8, 28, 20, 35, 16];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  warehouses.forEach((w, idx) => {
    sheet.addRow([
      idx + 1,
      w.name,
      w.sort_order,
      w.description || '',
      w.is_default ? 'Mặc định' : '',
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Nha_kho_${household.taxCode}_${dateFile}.xlsx`
  );
}