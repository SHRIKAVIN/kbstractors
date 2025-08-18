import { User, Pencil, Trash2, Phone } from 'lucide-react';
import type { JCBRecord } from '../types/jcb';
import { formatCurrency, calculateJCBTotalAmount } from '../utils/jcb-calculations';

interface JCBDataTableProps {
  records: JCBRecord[];
  onEdit: (record: JCBRecord) => void;
  onDelete: (record: JCBRecord) => void;
}

export function JCBDataTable({ records, onEdit, onDelete }: JCBDataTableProps) {
  if (records.length === 0) {
    return (
      <div data-testid="empty-state" className="bg-white rounded-lg shadow p-8 text-center">
        <h3 data-testid="empty-state-title" className="text-lg font-medium text-gray-900 mb-2">பதிவுகள் இல்லை</h3>
        <p data-testid="empty-state-message" className="text-gray-600">இன்னும் JCB பதிவுகள் எதுவும் சேர்க்கப்படவில்லை</p>
      </div>
    );
  }

  return (
    <div data-testid="data-table-container" className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50 backdrop-blur-sm">
      <div data-testid="table-header" className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-60"></div>
        <h3 data-testid="table-title" className="text-lg font-bold text-gray-900 text-center relative bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">JCB பதிவுகள்</h3>
      </div>
      <div data-testid="table-scroll-container" className="overflow-x-auto max-h-[60vh]">
        <table data-testid="jcb-table" className="min-w-full border border-gray-300 table-fixed">
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
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">பெயர்</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">விவரங்கள்</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">மொத்தம்</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">பெறப்பட்டது</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">நிலுவை</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">நிலை</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm">மொபைல்</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm" style={{ minWidth: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody data-testid="table-body" className="bg-white">
            {records.map((record, idx) => {
              const receivedAmount = record.amount_received || 0;
              const pendingAmount = Math.max((record.total_amount || 0) - receivedAmount, 0);
              const isPaid = pendingAmount <= 0 || record.old_balance_status === 'paid';
              const statusText = isPaid ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
              const statusClass = isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';

              return (
                <tr key={record.id} data-testid={`table-row-${idx}`} className={`hover:bg-blue-50 divide-x divide-gray-300 border-b border-gray-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{record.company_name}</div>
                        {record.driver_name ? (
                          <div className="text-xs text-gray-500">{record.driver_name}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <div className="text-sm text-gray-900 flex flex-col gap-1">
                      {(record.details && record.details.length > 0) ? (
                        record.details.map((d, detailIdx) => {
                          const amount = calculateJCBTotalAmount(parseFloat(String(d.hours || '0')) || 0, d.equipment_type);
                          return (
                            <div key={detailIdx} className="font-semibold text-base">
                              <span>{String(d.hours || '')} மணி</span>
                              <span className="mx-2">•</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">{d.equipment_type}</span>
                              <span className="ml-2 text-xs text-gray-500">( {formatCurrency(amount)} )</span>
                            </div>
                          );
                        })
                      ) : null}
                      {record.old_balance && (
                        <div className="font-semibold text-base text-gray-700 mt-1">
                          <span className={record.old_balance_status === 'paid' ? 'text-green-600' : 'text-red-600'}>
                            பழைய பாக்கி {record.old_balance}
                            {record.old_balance_reason && (
                              <span className="text-xs text-gray-500"> ( {record.old_balance_reason} )</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-900 text-center">{formatCurrency(record.total_amount || 0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-green-600 text-center">{formatCurrency(receivedAmount)}</td>
                  <td className={"px-3 py-2 whitespace-nowrap font-semibold text-center " + (pendingAmount > 0 ? 'text-red-600' : 'text-green-600')}>{formatCurrency(pendingAmount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>{statusText}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    {record.mobile_number ? (
                      <button
                        onClick={() => window.open(`tel:${record.mobile_number}`, '_self')}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Click to call"
                      >
                        <span className="font-medium flex items-center justify-center gap-1"><Phone className="w-4 h-4" />{record.mobile_number}</span>
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm italic text-center block">Not provided</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="flex justify-center gap-3">
                      <button onClick={() => onEdit(record)} title="Edit">
                        <Pencil className="w-5 h-5 text-orange-500 hover:text-orange-700" />
                      </button>
                      <button onClick={() => onDelete(record)} title="Delete">
                        <Trash2 className="w-5 h-5 text-red-600 hover:text-red-800" />
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
