import React from 'react';
import { Edit, Trash2, Eye } from 'lucide-react';
import type { JCBRecord } from '../types/jcb';
import { formatCurrency } from '../utils/jcb-calculations';

interface JCBDataTableProps {
  records: JCBRecord[];
  onEdit: (record: JCBRecord) => void;
  onDelete: (record: JCBRecord) => void;
}

export function JCBDataTable({ records, onEdit, onDelete }: JCBDataTableProps) {
  const getStatusColor = (record: JCBRecord) => {
    if (record.old_balance_status) {
      return record.old_balance_status === 'paid' ? 'text-green-600' : 'text-red-600';
    }
    if (record.amount_received && record.total_amount) {
      return record.amount_received >= record.total_amount ? 'text-green-600' : 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getStatusText = (record: JCBRecord) => {
    if (record.old_balance_status) {
      return record.old_balance_status === 'paid' ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
    }
    if (record.amount_received && record.total_amount) {
      return record.amount_received >= record.total_amount ? 'முழுமையாக பெறப்பட்டது' : 'நிலுவையில்';
    }
    return 'தொகை குறிப்பிடப்படவில்லை';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ta-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-lg">JCB பதிவுகள் எதுவும் இல்லை</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                விவரங்கள்
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                தொகை
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                நிலை
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                தேதி
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                செயல்கள்
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-3 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{record.company_name}</div>
                    {record.driver_name && (
                      <div className="text-gray-500 text-xs">Driver: {record.driver_name}</div>
                    )}
                    {record.mobile_number && (
                      <div className="text-gray-500">{record.mobile_number}</div>
                    )}
                    {record.details && record.details.length > 0 && (
                      <div className="mt-1">
                        {record.details.map((detail, index) => (
                          <div key={index} className="text-xs text-gray-600">
                            {detail.hours} மணி - {detail.equipment_type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(record.total_amount)}
                    </div>
                    {record.amount_received !== undefined && record.amount_received > 0 && (
                      <div className="text-gray-500 text-xs">
                        பெறப்பட்டது: {formatCurrency(record.amount_received)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record)}`}>
                    {getStatusText(record)}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.created_at)}
                  {record.work_date && (
                    <div className="text-xs text-gray-400">
                      வேலை: {formatDate(record.work_date)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                      title="திருத்து"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(record)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                      title="நீக்கு"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
