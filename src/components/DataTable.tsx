import { User, Settings, Pencil, Trash2, Phone } from 'lucide-react';
import type { RentalRecord } from '../types/rental';
import { formatCurrency, calculateTotalAmount} from '../utils/calculations';

interface DataTableProps {
  records: RentalRecord[];
  onEdit?: (record: RentalRecord) => void;
  onDelete?: (record: RentalRecord) => void;
}

export function DataTable({ records, onEdit, onDelete }: DataTableProps) {
  if (records.length === 0) {
    return (
      <div data-testid="empty-state" className="bg-white rounded-lg shadow p-8 text-center">
        <div data-testid="empty-state-icon" className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Settings data-testid="settings-icon" className="w-8 h-8 text-gray-400" />
        </div>
        <h3 data-testid="empty-state-title" className="text-lg font-medium text-gray-900 mb-2">பதிவுகள் இல்லை</h3>
        <p data-testid="empty-state-message" className="text-gray-600">இன்னும் வாடகை பதிவுகள் எதுவும் சேர்க்கப்படவில்லை</p>
      </div>
    );
  }

  return (
    <div data-testid="data-table-container" className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm">
      <div data-testid="table-header" className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-60"></div>
        <h3 data-testid="table-title" className="text-lg font-bold text-gray-900 text-center relative bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">வாடகை பதிவுகள்</h3>
      </div>
      <div data-testid="table-scroll-container" className="overflow-x-auto max-h-[60vh]">
        <table data-testid="rental-table" className="min-w-full border border-gray-300 table-fixed">
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead data-testid="table-head" className="bg-gradient-to-r from-blue-200 to-indigo-300 sticky top-0 z-10 shadow-md">
            <tr data-testid="table-head-row" className="divide-x divide-gray-300">
              <th data-testid="name-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">பெயர்</th>
              <th data-testid="details-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">விவரங்கள்</th>
              <th data-testid="total-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">மொத்தம்</th>
              <th data-testid="received-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">பெறப்பட்டது</th>
              <th data-testid="pending-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">நிலுவை</th>
              <th data-testid="status-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">நிலை</th>
              <th data-testid="mobile-header" className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">மொபைல்</th>
              <th data-testid="actions-header" className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm" style={{ minWidth: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody data-testid="table-body" className="bg-white">
            {records.map((record, idx) => {
              // Fix the status calculation:
              let isPaid = false;
              let pendingAmount = record.total_amount - record.received_amount;
              let statusText = '';
              let statusClass = '';
              
              // Status should be "paid" only if there is no pending amount
              isPaid = pendingAmount <= 0;
              statusText = isPaid ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
              statusClass = isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
              
              return (
                <tr key={record.id} data-testid={`table-row-${idx}`} className={`hover:bg-blue-50 divide-x divide-gray-300 border-b border-gray-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td data-testid={`name-cell-${idx}`} className="px-3 py-2 whitespace-nowrap">
                    <div data-testid={`name-content-${idx}`} className="flex items-center">
                      <div data-testid={`user-avatar-${idx}`} className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User data-testid={`user-icon-${idx}`} className="h-5 w-5 text-blue-600" />
                      </div>
                      <div data-testid={`name-text-${idx}`} className="ml-4">
                        <div data-testid={`customer-name-${idx}`} className="text-sm font-medium text-gray-900">{record.name}</div>
                      </div>
                    </div>
                  </td>
                  <td data-testid={`details-cell-${idx}`} className="px-3 py-2 whitespace-nowrap align-top">
                    <div data-testid={`details-content-${idx}`} className="text-sm text-gray-900 flex flex-col gap-1">
                      {(record.details && record.details.length > 0) ? (
                        record.details.map((d, detailIdx) => {
                          let amount = 0;
                          // Fix the machinery details display:
                          if (d.equipment_type === 'Dipper') {
                            amount = 500 * (parseInt(String(d.nadai || '0')) || 0);
                          } else {
                            amount = calculateTotalAmount(
                              parseFloat(String(d.acres || '0')) || 0,
                              parseFloat(String(d.rounds || '0')) || 0,
                              d.equipment_type
                            );
                          }
                          return (
                            <div key={detailIdx} data-testid={`detail-item-${idx}-${detailIdx}`} className="font-semibold text-base">
                              {d.equipment_type === 'Dipper' ? (
                                <>
                                  <span data-testid={`nadai-${idx}-${detailIdx}`}>{String(d.nadai || '')} நடை</span>
                                  <span data-testid={`separator-1-${idx}-${detailIdx}`} className="mx-2">•</span>
                                  <span data-testid={`equipment-type-${idx}-${detailIdx}`} className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">Dipper</span>
                                  <span data-testid={`amount-${idx}-${detailIdx}`} className="ml-2 text-xs text-gray-500">( {formatCurrency(amount)} )</span>
                                </>
                              ) : (
                                <>
                                  <span data-testid={`acres-${idx}-${detailIdx}`}>{String(d.acres || '')} மா</span>
                                  <span data-testid={`separator-2-${idx}-${detailIdx}`} className="mx-2">•</span>
                                  <span data-testid={`rounds-${idx}-${detailIdx}`}>{String(d.rounds || '')} சால்</span>
                                  <span data-testid={`separator-3-${idx}-${detailIdx}`} className="mx-2">•</span>
                                  <span data-testid={`equipment-type-${idx}-${detailIdx}`} className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">{d.equipment_type === 'Rotavator' ? 'Rotavator' : d.equipment_type}</span>
                                  <span data-testid={`amount-${idx}-${detailIdx}`} className="ml-2 text-xs text-gray-500">( {formatCurrency(amount)} )</span>
                                </>
                              )}
                            </div>
                          );
                        })
                      ) : null}
                      {record.old_balance && (
                        <div data-testid={`old-balance-${idx}`} className="font-semibold text-base text-gray-700 mt-1">
                          <span data-testid={`old-balance-text-${idx}`} className={record.old_balance_status === 'paid' ? 'text-green-600' : 'text-red-600'}>
                            பழைய பாக்கி {record.old_balance}
                            {record.old_balance_reason && (
                              <span data-testid={`old-balance-reason-${idx}`} className="text-xs text-gray-500"> ( {record.old_balance_reason} )</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td data-testid={`total-cell-${idx}`} className="px-3 py-2 whitespace-nowrap font-semibold text-gray-900">{formatCurrency(record.total_amount)}</td>
                  <td data-testid={`received-cell-${idx}`} className="px-3 py-2 whitespace-nowrap font-semibold text-green-600">{formatCurrency(record.received_amount)}</td>
                  <td data-testid={`pending-cell-${idx}`} className={"px-3 py-2 whitespace-nowrap font-semibold " + (pendingAmount > 0 ? 'text-red-600' : 'text-green-600')}>{formatCurrency(pendingAmount)}</td>
                  <td data-testid={`status-cell-${idx}`} className="px-3 py-2 whitespace-nowrap">
                    <span data-testid={`status-badge-${idx}`} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>
                      {statusText}
                    </span>
                  </td>
                  <td data-testid={`mobile-cell-${idx}`} className="px-3 py-2 whitespace-nowrap">
                    {record.mobile_number ? (
                      <button
                        data-testid={`mobile-call-button-${idx}`}
                        onClick={() => window.open(`tel:${record.mobile_number}`, '_self')}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Click to call"
                      >
                        <span className="font-medium">{record.mobile_number}</span>
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm italic text-center block">Not provided</span>
                    )}
                  </td>
                  <td data-testid={`actions-cell-${idx}`} className="px-3 py-2 whitespace-nowrap text-center">
                    <div data-testid={`actions-container-${idx}`} className="flex justify-center gap-3">
                      <button data-testid={`edit-button-${idx}`} onClick={() => onEdit && onEdit(record)} title="Edit">
                        <Pencil data-testid={`edit-icon-${idx}`} className="w-5 h-5 text-orange-500 hover:text-orange-700" />
                      </button>
                      <button data-testid={`delete-button-${idx}`} onClick={() => onDelete && onDelete(record)} title="Delete">
                        <Trash2 data-testid={`delete-icon-${idx}`} className="w-5 h-5 text-red-600 hover:text-red-800" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}