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
  // Flatten records for Excel: one row per detail, or a single row for old balance only
  const rows: any[] = [];
  records.forEach(record => {
    if (record.details && record.details.length > 0) {
      record.details.forEach(d => {
        rows.push({
          'பெயர்': record.name,
          'மா': d.acres,
          'வகை': d.equipment_type,
          'சால்': d.rounds,
          'மொத்த தொகை': record.total_amount,
          'பெறப்பட்ட தொகை': record.received_amount,
          'தேதி': new Date(record.created_at).toLocaleDateString('ta-IN')
        });
      });
    } else {
      // Old balance only record
      rows.push({
        'பெயர்': record.name,
        'மா': '',
        'வகை': '',
        'சால்': '',
        'மொத்த தொகை': '',
        'பெறப்பட்ட தொகை': '',
        'தேதி': new Date(record.created_at).toLocaleDateString('ta-IN')
      });
    }
  });
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rental Records');
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
      if ((!record.details || record.details.length === 0) && record.old_balance) {
        const status = record.old_balance_status === 'paid' ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
        body.push([
          { text: record.name, alignment: 'left' },
          '', '', '', '', '', '',
          { text: status, alignment: 'center' },
          { text: record.old_balance, alignment: 'right' },
          { text: new Date(record.created_at).toLocaleDateString('ta-IN'), alignment: 'left' }
        ]);
      } else if (record.details && record.details.length > 0) {
        record.details.forEach((d, idx) => {
          const status = record.old_balance_status
            ? (record.old_balance_status === 'paid' ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்')
            : (record.received_amount >= record.total_amount ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்');
          if (idx === 0) {
            body.push([
              { text: record.name, alignment: 'left' },
              { text: d.acres, alignment: 'center' },
              { text: d.rounds, alignment: 'center' },
              { text: d.equipment_type, alignment: 'left' },
              { text: formatCurrency(record.total_amount), alignment: 'right' },
              { text: formatCurrency(record.received_amount), alignment: 'right' },
              { text: formatCurrency(record.total_amount - record.received_amount), alignment: 'right' },
              { text: status, alignment: 'center' },
              { text: record.old_balance || '', alignment: 'right' },
              { text: new Date(record.created_at).toLocaleDateString('ta-IN'), alignment: 'left' }
            ]);
          } else {
            body.push([
              '',
              { text: d.acres, alignment: 'center' },
              { text: d.rounds, alignment: 'center' },
              { text: d.equipment_type, alignment: 'left' },
              { text: '', colSpan: 6 }, '', '', '', '', ''
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