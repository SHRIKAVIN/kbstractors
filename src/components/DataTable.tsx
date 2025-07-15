import { User, Settings, Pencil, Trash2 } from 'lucide-react';
import type { RentalRecord } from '../types/rental';
import { formatCurrency } from '../utils/calculations';

interface DataTableProps {
  records: RentalRecord[];
  onEdit?: (record: RentalRecord) => void;
  onDelete?: (record: RentalRecord) => void;
}

export function DataTable({ records, onEdit, onDelete }: DataTableProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">பதிவுகள் இல்லை</h3>
        <p className="text-gray-600">இன்னும் வாடகை பதிவுகள் எதுவும் சேர்க்கப்படவில்லை</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">வாடகை பதிவுகள்</h3>
        <p className="text-sm text-gray-600 mt-1">மொத்தம் {records.length} பதிவுகள்</p>
      </div>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="min-w-full border border-gray-300 table-fixed">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="divide-x divide-gray-300">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">பெயர்</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">விவரங்கள்</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">மொத்தம்</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">பெறப்பட்டது</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">நிலுவை</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">நிலை</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300" style={{ minWidth: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {records.map((record, idx) => {
              let isPaid = false;
              let pendingAmount = record.total_amount - record.received_amount;
              let statusText = '';
              let statusClass = '';
              if (record.old_balance_status) {
                isPaid = record.old_balance_status === 'paid';
                statusText = isPaid ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
                statusClass = isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
              } else {
                isPaid = record.received_amount >= record.total_amount;
                statusText = isPaid ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
                statusClass = isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
              }
              return (
                <tr key={record.id} className={`hover:bg-blue-50 divide-x divide-gray-300 border-b border-gray-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{record.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <div className="text-sm text-gray-900 flex flex-col gap-1">
                      {(record.details && record.details.length > 0) ? (
                        record.details.map((d, idx) => (
                          <div key={idx} className="font-semibold text-base">
                            {d.equipment_type === 'Dipper' ? (
                              <>
                                <span>{d.nadai} நடை</span>
                                <span className="mx-2">•</span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">Dipper</span>
                              </>
                            ) : (
                              <>
                                <span>{d.acres} மா</span>
                                <span className="mx-2">•</span>
                                <span>{d.rounds} சால்</span>
                                <span className="mx-2">•</span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">{d.equipment_type === 'Rotavator' ? 'Rotavator' : d.equipment_type}</span>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {record.old_balance && (
                        <div className="font-semibold text-base text-gray-700 mt-1">
                          <span className={record.old_balance_status === 'paid' ? 'text-green-600' : 'text-red-600'}>
                            பழைய பாக்கி {record.old_balance}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-900">{formatCurrency(record.total_amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-green-600">{formatCurrency(record.received_amount)}</td>
                  <td className={"px-3 py-2 whitespace-nowrap font-semibold " + (pendingAmount > 0 ? 'text-orange-600' : 'text-green-600')}>{formatCurrency(pendingAmount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="flex justify-center gap-3">
                      <button onClick={() => onEdit && onEdit(record)} title="Edit">
                        <Pencil className="w-5 h-5 text-orange-500 hover:text-orange-700" />
                      </button>
                      <button onClick={() => onDelete && onDelete(record)} title="Delete">
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
