import React from 'react';
import { Calendar, User, Settings, Pencil, Trash2 } from 'lucide-react';
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">பெயர்</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">விவரங்கள்</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">மொத்தம்</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">பெறப்பட்டது</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">நிலுவை</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">நிலை</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => {
              const isPaid = record.received_amount >= record.total_amount;
              const pendingAmount = record.total_amount - record.received_amount;
              return (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{record.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap align-top">
                    <div className="text-sm text-gray-900">
                      {(record.details ?? []).map((d, idx) => (
                        <div key={idx} className="font-semibold text-base mt-0.5">
                          <span>{d.acres} மா</span>
                          <span className="mx-2">•</span>
                          <span>{d.rounds} சால்</span>
                          <span className="mx-2">•</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded font-medium align-middle">{d.equipment_type}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{formatCurrency(record.total_amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-green-600">{formatCurrency(record.received_amount)}</td>
                  <td className={"px-6 py-4 whitespace-nowrap font-semibold " + (pendingAmount > 0 ? 'text-orange-600' : 'text-green-600')}>{formatCurrency(pendingAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {isPaid ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்'}
                    </span>
                    {record.old_balance && (
                      <div className="mt-2 inline-block bg-gray-100 rounded px-3 py-1 text-xs text-gray-700 font-medium">
                        பழைய பாக்கி: {record.old_balance}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center gap-3">
                      <button onClick={() => onEdit && onEdit(record)}>
                        <Pencil className="w-5 h-5 text-orange-500 hover:text-orange-700" />
                      </button>
                      <button onClick={() => onDelete && onDelete(record)}>
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