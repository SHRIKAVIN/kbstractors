import * as XLSX from 'xlsx';
import type { RentalRecord } from '../types/rental';
import { formatCurrency } from './calculations';
// PDFMake import and font setup
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
// Import the base64-encoded Tamil font using Vite's ?raw import
import notoSansTamilBase64 from '../assets/fonts/Noto_Sans_Tamil/NotoSansTamil-Regular.ttf.base64?raw';
// Import the base64-encoded logo
import kbsLogoBase64 from '../../public/icons/kbs-tractors-96.png.base64?raw';

// Embed the base64-encoded Tamil font in pdfmake VFS
(pdfMake as any).vfs = {
  'NotoSansTamil-Regular.ttf': notoSansTamilBase64,
};

// Set the fonts globally for pdfMake
(pdfMake as any).fonts = {
  NotoSansTamil: {
    normal: 'NotoSansTamil-Regular.ttf',
    bold: 'NotoSansTamil-Regular.ttf',
    italics: 'NotoSansTamil-Regular.ttf',
    bolditalics: 'NotoSansTamil-Regular.ttf'
  }
};

export function exportToExcel(records: RentalRecord[], filename: string = 'kbs-tractors-records.xlsx') {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  
  // Create headers
  const headers = ['பெயர்', 'மா', 'சால்', 'வகை', 'மொத்தம்', 'பெறப்பட்டது', 'நிலுவை', 'நிலை', 'பழைய பாக்கி', 'தேதி'];
  
  // Prepare data with merged cells logic
  const rows: any[][] = [headers];
  const merges: any[] = [];
  let currentRow = 1; // Start from row 1 (0-indexed, after header)
  
  records.forEach(record => {
    const status = record.old_balance_status
      ? (record.old_balance_status === 'paid' ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்')
      : (record.received_amount >= record.total_amount ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்');
    
    const pendingAmount = record.total_amount - record.received_amount;
    const formattedDate = new Date(record.created_at).toLocaleDateString('ta-IN');
    
    if ((!record.details || record.details.length === 0) && record.old_balance) {
      // Old balance only record
      rows.push([
        record.name,
        '',
        '',
        '',
        '',
        '',
        '',
        status,
        record.old_balance,
        formattedDate
      ]);
      currentRow++;
    } else if (record.details && record.details.length > 0) {
      const detailsCount = record.details.length;
      const startRow = currentRow;
      
      // Add rows for each detail
      record.details.forEach((detail, idx) => {
        if (idx === 0) {
          // First row contains all data
          rows.push([
            record.name,
            detail.equipment_type === 'Dipper' ? '' : detail.acres,
            detail.equipment_type === 'Dipper' ? '' : detail.rounds,
            detail.equipment_type === 'Dipper' ? `${detail.nadai} நடை - Dipper` : detail.equipment_type,
            formatCurrency(record.total_amount),
            formatCurrency(record.received_amount),
            formatCurrency(pendingAmount),
            status,
            record.old_balance || '',
            formattedDate
          ]);
        } else {
          // Subsequent rows only have detail data
          rows.push([
            '', // Name will be merged
            detail.equipment_type === 'Dipper' ? '' : detail.acres,
            detail.equipment_type === 'Dipper' ? '' : detail.rounds,
            detail.equipment_type === 'Dipper' ? `${detail.nadai} நடை - Dipper` : detail.equipment_type,
            '', // Total will be merged
            '', // Received will be merged
            '', // Balance will be merged
            '', // Status will be merged
            '', // Old balance will be merged
            '' // Date will be merged
          ]);
        }
        currentRow++;
      });
      
      // Add merge ranges for cells that should span multiple rows
      if (detailsCount > 1) {
        const endRow = startRow + detailsCount - 1;
        // Merge name (column A)
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        // Merge total (column E)
        merges.push({ s: { r: startRow, c: 4 }, e: { r: endRow, c: 4 } });
        // Merge received (column F)
        merges.push({ s: { r: startRow, c: 5 }, e: { r: endRow, c: 5 } });
        // Merge balance (column G)
        merges.push({ s: { r: startRow, c: 6 }, e: { r: endRow, c: 6 } });
        // Merge status (column H)
        merges.push({ s: { r: startRow, c: 7 }, e: { r: endRow, c: 7 } });
        // Merge old balance (column I)
        merges.push({ s: { r: startRow, c: 8 }, e: { r: endRow, c: 8 } });
        // Merge date (column J)
        merges.push({ s: { r: startRow, c: 9 }, e: { r: endRow, c: 9 } });
      }
    }
  });
  
  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  
  // Apply merges
  if (merges.length > 0) {
    worksheet['!merges'] = merges;
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rental Records');
  
  // Save file
  XLSX.writeFile(workbook, filename);
}

export function exportToPDF(records: RentalRecord[], filename: string = 'kbs-tractors-records.pdf') {
  try {
    const headers = [
      { text: 'பெயர்', style: 'tableHeader', alignment: 'left' },
      { text: 'மா', style: 'tableHeader', alignment: 'center' },
      { text: 'சால்', style: 'tableHeader', alignment: 'center' },
      { text: 'வகை', style: 'tableHeader', alignment: 'left' },
      { text: 'மொத்தம்', style: 'tableHeader', alignment: 'right' },
      { text: 'பெறப்பட்டது', style: 'tableHeader', alignment: 'right' },
      { text: 'நிலுவை', style: 'tableHeader', alignment: 'right' },
      { text: 'நிலை', style: 'tableHeader', alignment: 'center' },
      { text: 'பழைய பாக்கி', style: 'tableHeader', alignment: 'right' },
      { text: 'தேதி', style: 'tableHeader', alignment: 'left' }
    ];
    
    const body: any[] = [];
    
    records.forEach(record => {
      const status = record.old_balance_status
        ? (record.old_balance_status === 'paid' ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்')
        : (record.received_amount >= record.total_amount ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்');
      
      const pendingAmount = record.total_amount - record.received_amount;
      const formattedDate = new Date(record.created_at).toLocaleDateString('ta-IN');
      
      if ((!record.details || record.details.length === 0) && record.old_balance) {
        // Old balance only record
        body.push([
          { text: record.name, alignment: 'left' },
          { text: '', alignment: 'center' },
          { text: '', alignment: 'center' },
          { text: '', alignment: 'left' },
          { text: '', alignment: 'right' },
          { text: '', alignment: 'right' },
          { text: '', alignment: 'right' },
          { text: status, alignment: 'center' },
          { text: record.old_balance, alignment: 'right' },
          { text: formattedDate, alignment: 'left' }
        ]);
      } else if (record.details && record.details.length > 0) {
        const detailsCount = record.details.length;
        
        record.details.forEach((detail, idx) => {
          if (idx === 0) {
            // First row with merged cells
            body.push([
              { text: record.name, alignment: 'left', rowSpan: detailsCount },
              { text: detail.equipment_type === 'Dipper' ? '' : detail.acres, alignment: 'center' },
              { text: detail.equipment_type === 'Dipper' ? '' : detail.rounds, alignment: 'center' },
              { text: detail.equipment_type === 'Dipper' ? `${detail.nadai} நடை - Dipper` : detail.equipment_type, alignment: 'left' },
              { text: formatCurrency(record.total_amount), alignment: 'right', rowSpan: detailsCount },
              { text: formatCurrency(record.received_amount), alignment: 'right', rowSpan: detailsCount },
              { text: formatCurrency(pendingAmount), alignment: 'right', rowSpan: detailsCount },
              { text: status, alignment: 'center', rowSpan: detailsCount },
              { text: record.old_balance || '', alignment: 'right', rowSpan: detailsCount },
              { text: formattedDate, alignment: 'left', rowSpan: detailsCount }
            ]);
          } else {
            // Subsequent rows with empty cells for merged columns
            body.push([
              '', // Name (merged)
              { text: detail.equipment_type === 'Dipper' ? '' : detail.acres, alignment: 'center' },
              { text: detail.equipment_type === 'Dipper' ? '' : detail.rounds, alignment: 'center' },
              { text: detail.equipment_type === 'Dipper' ? `${detail.nadai} நடை - Dipper` : detail.equipment_type, alignment: 'left' },
              '', // Total (merged)
              '', // Received (merged)
              '', // Balance (merged)
              '', // Status (merged)
              '', // Old balance (merged)
              '' // Date (merged)
            ]);
          }
        });
      }
    });
    
    const docDefinition = {
      content: [
        {
          image: 'logo',
          width: 70,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        { text: 'KBS TRACTORS - RENTAL RECORDS', fontSize: 22, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
        { text: `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, fontSize: 11, alignment: 'center', margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths: [65, 20, 20, 45, 38, 38, 38, 40, 45, 60],
            body: [headers, ...body]
          },
          alignment: 'center',
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#2563eb' : (rowIndex % 2 === 0 ? '#F3F4F6' : null),
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#222',
            vLineColor: () => '#222',
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 2,
            paddingBottom: () => 2
          }
        }
      ],
      images: {
        logo: 'data:image/png;base64,' + kbsLogoBase64.trim()
      },
      defaultStyle: {
        font: 'NotoSansTamil',
        fontSize: 8
      },
      styles: {
        tableHeader: {
          bold: true,
          color: 'white',
          fillColor: '#2563eb',
          font: 'NotoSansTamil',
          fontSize: 8,
          alignment: 'center',
          margin: [0, 3, 0, 3]
        }
      }
    };
    
    pdfMake.createPdf(docDefinition).download(filename);
  } catch (err) {
    alert('PDF export failed: ' + (err instanceof Error ? err.message : err));
  }
}