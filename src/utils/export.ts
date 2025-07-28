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
  const headers = ['பெயர்', 'விவரங்கள்', 'மொத்தம்', 'பெறப்பட்டது', 'நிலுவை', 'நிலை', 'தேதி'];
  
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
        `பழைய பாக்கி ${record.old_balance}`,
        '',
        '',
        '',
        status,
        formattedDate
      ]);
      currentRow++;
    } else if (record.details && record.details.length > 0) {
      const detailsCount = record.details.length;
      const hasOldBalance = record.old_balance ? 1 : 0;
      const totalRows = detailsCount + hasOldBalance;
      const startRow = currentRow;
      
      // Add rows for each detail
      record.details.forEach((detail, idx) => {
        let detailText;
        if (detail.equipment_type === 'Dipper') {
          detailText = `${detail.nadai} நடை - Dipper`;
        } else {
          detailText = `${detail.acres} மா•${detail.rounds} சால்•${detail.equipment_type}`;
        }
        
        if (idx === 0) {
          // First row contains all data
          rows.push([
            record.name,
            detailText,
            formatCurrency(record.total_amount),
            formatCurrency(record.received_amount),
            formatCurrency(pendingAmount),
            status,
            formattedDate
          ]);
        } else {
          // Subsequent rows only have detail data
          rows.push([
            '', // Name will be merged
            detailText,
            '', // Total will be merged
            '', // Received will be merged
            '', // Balance will be merged
            '', // Status will be merged
            '' // Date will be merged
          ]);
        }
        currentRow++;
      });
      
      // Add old balance row if exists
      if (record.old_balance) {
        rows.push([
          '', // Name will be merged
          `பழைய பாக்கி ${record.old_balance}`,
          '', // Total will be merged
          '', // Received will be merged
          '', // Balance will be merged
          '', // Status will be merged
          '' // Date will be merged
        ]);
        currentRow++;
      }
      
      // Add merge ranges for cells that should span multiple rows
      if (totalRows > 1) {
        const endRow = startRow + totalRows - 1;
        // Merge name (column A)
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        // Merge total (column C)
        merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
        // Merge received (column D)
        merges.push({ s: { r: startRow, c: 3 }, e: { r: endRow, c: 3 } });
        // Merge balance (column E)
        merges.push({ s: { r: startRow, c: 4 }, e: { r: endRow, c: 4 } });
        // Merge status (column F)
        merges.push({ s: { r: startRow, c: 5 }, e: { r: endRow, c: 5 } });
        // Merge date (column G)
        merges.push({ s: { r: startRow, c: 6 }, e: { r: endRow, c: 6 } });
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
      { text: 'பெயர்', style: 'tableHeader', alignment: 'center' },
      { text: 'விவரங்கள்', style: 'tableHeader', alignment: 'center' },
      { text: 'மொத்தம்', style: 'tableHeader', alignment: 'center' },
      { text: 'பெறப்பட்டது', style: 'tableHeader', alignment: 'center' },
      { text: 'நிலுவை', style: 'tableHeader', alignment: 'center' },
      { text: 'நிலை', style: 'tableHeader', alignment: 'center' },
      { text: 'தேதி', style: 'tableHeader', alignment: 'center' }
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
          { text: record.name, alignment: 'center' },
          { text: `பழைய பாக்கி ${record.old_balance}`, alignment: 'center' },
          { text: '', alignment: 'center' },
          { text: '', alignment: 'center' },
          { text: '', alignment: 'center' },
          { text: status, alignment: 'center' },
          { text: formattedDate, alignment: 'center' }
        ]);
      } else if (record.details && record.details.length > 0) {
        const detailsCount = record.details.length;
        const hasOldBalance = record.old_balance ? 1 : 0;
        const totalRows = detailsCount + hasOldBalance;
        
        record.details.forEach((detail, idx) => {
          let detailText;
          if (detail.equipment_type === 'Dipper') {
            detailText = `${detail.nadai} நடை - Dipper`;
          } else {
            detailText = `${detail.acres} மா•${detail.rounds} சால்•${detail.equipment_type}`;
          }
          
          if (idx === 0) {
            // First row with merged cells
            body.push([
              { text: record.name, alignment: 'center', rowSpan: totalRows },
              { text: detailText, alignment: 'center' },
              { text: formatCurrency(record.total_amount), alignment: 'center', rowSpan: totalRows },
              { text: formatCurrency(record.received_amount), alignment: 'center', rowSpan: totalRows },
              { text: formatCurrency(pendingAmount), alignment: 'center', rowSpan: totalRows },
              { text: status, alignment: 'center', rowSpan: totalRows },
              { text: formattedDate, alignment: 'center', rowSpan: totalRows }
            ]);
          } else {
            // Subsequent rows with empty cells for merged columns
            body.push([
              '', // Name (merged)
              { text: detailText, alignment: 'center' },
              '', // Total (merged)
              '', // Received (merged)
              '', // Balance (merged)
              '', // Status (merged)
              '' // Date (merged)
            ]);
          }
        });
        
        // Add old balance row if exists
        if (record.old_balance) {
          body.push([
            '', // Name (merged)
            { text: `பழைய பாக்கி ${record.old_balance}`, alignment: 'center' },
            '', // Total (merged)
            '', // Received (merged)
            '', // Balance (merged)
            '', // Status (merged)
            '' // Date (merged)
          ]);
        }
      }
    });
    
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 50],
      content: [
        {
          stack: [
            {
              image: 'logo',
              width: 60,
              alignment: 'center',
              margin: [0, 0, 0, 10]
            },
            { text: 'KBS TRACTORS - RENTAL RECORDS', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
            { text: `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, fontSize: 10, alignment: 'center', margin: [0, 0, 0, 15] },
            {
              table: {
                headerRows: 1,
                widths: [80, 120, 70, 70, 70, 80, 70],
                body: [headers, ...body]
              },
              layout: {
                fillColor: (rowIndex: number) => rowIndex === 0 ? '#2563eb' : (rowIndex % 2 === 0 ? '#F3F4F6' : null),
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => '#222',
                vLineColor: () => '#222',
                paddingLeft: () => 4,
                paddingRight: () => 4,
                paddingTop: () => 6,
                paddingBottom: () => 6
              }
            }
          ],
          alignment: 'center'
        }
      ],
      images: {
        logo: 'data:image/png;base64,' + kbsLogoBase64.trim()
      },
      defaultStyle: {
        font: 'NotoSansTamil',
        fontSize: 9
      },
      styles: {
        tableHeader: {
          bold: true,
          color: 'white',
          fillColor: '#2563eb',
          font: 'NotoSansTamil',
          fontSize: 9,
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