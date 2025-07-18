import{ useState, useEffect } from 'react';
import { Plus, Download,LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { rentalService } from '../lib/supabase';
import { RentalForm } from './RentalForm';
import { DataTable } from './DataTable';
import type { RentalRecord } from '../types/rental';
import { exportToExcel, exportToPDF } from '../utils/export';
import { formatCurrency } from '../utils/calculations';

export function Dashboard() {
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<RentalRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    equipment: '',
    dateFrom: '',
    dateTo: '',
    name: '',
    status: '',
    oldBalanceStatus: '',
  });
  const [editRecord, setEditRecord] = useState<RentalRecord | null>(null);
  const { signOut } = useAuth();

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, filter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await rentalService.getAll();
      setRecords(data);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = records;

    if (filter.equipment) {
      filtered = filtered.filter(record =>
        Array.isArray(record.details) &&
        (
          record.details.some(d => d.equipment_type === filter.equipment) ||
          (filter.equipment === 'Others' && record.details.some(d => !['Cage Wheel', 'Rotavator', 'புழுதி', 'Mini', 'Dipper'].includes(d.equipment_type)))
        )
      );
    }

    if (filter.dateFrom) {
      filtered = filtered.filter(record => 
        new Date(record.created_at) >= new Date(filter.dateFrom)
      );
    }

    if (filter.dateTo) {
      filtered = filtered.filter(record => 
        new Date(record.created_at) <= new Date(filter.dateTo)
      );
    }

    if (filter.name) {
      filtered = filtered.filter(record => record.name.toLowerCase().includes(filter.name.toLowerCase()));
    }

    if (filter.status) {
      filtered = filtered.filter(record => {
        let status;
        if (record.old_balance_status) {
          status = record.old_balance_status;
        } else {
          status = (record.received_amount >= record.total_amount) ? 'paid' : 'pending';
        }
        return status === filter.status;
      });
    }

    if (filter.oldBalanceStatus) {
      filtered = filtered.filter(record => {
        if (!record.old_balance) return false;
        return record.old_balance_status === filter.oldBalanceStatus;
      });
    }

    setFilteredRecords(filtered);
  };

  const handleRecordAdded = (newRecord: RentalRecord) => {
    setRecords(prev => [newRecord, ...prev]);
    setShowForm(false);
  };

  const handleEdit = (record: RentalRecord) => {
    setEditRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (record: RentalRecord) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await rentalService.delete(record.id);
        setRecords(prev => prev.filter(r => r.id !== record.id));
      } catch (error) {
        alert('Failed to delete record from database.');
        console.error(error);
      }
    }
  };

  const handleClearFilters = () => {
    setFilter({ equipment: '', dateFrom: '', dateTo: '', name: '', status: '', oldBalanceStatus: '' });
  };

  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.total_amount, 0);
  const totalReceived = filteredRecords.reduce((sum, record) => sum + record.received_amount, 0);
  const pendingAmount = totalAmount - totalReceived;

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">தகவல்களை ஏற்றுகிறது...</p>
        </div>
      </div>
    );
  }

  if (showForm && editRecord) {
    return <RentalForm onClose={() => { setShowForm(false); setEditRecord(null); }} onSave={async (updated) => {
      try {
        // Refetch the updated record from DB (optional, for consistency)
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
      } catch (error) {
        alert('Failed to update record from database.');
        console.error(error);
      }
      setShowForm(false);
      setEditRecord(null);
    }} initialData={editRecord} />;
  }
  if (showForm) {
    return <RentalForm onClose={() => setShowForm(false)} onSave={handleRecordAdded} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-4 pb-2">
          <div className="flex flex-col items-center">
            <img src="/icons/kbs-tractors-96.png" alt="KBS Tractors Logo" className="w-14 h-14 rounded-full shadow mb-2" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center">KBS Tractors</h1>
            <p className="text-xs sm:text-sm text-gray-600 text-center mb-4">நிர்வாக பேனல்</p>
            <div className="flex flex-row items-center justify-center gap-3 w-full max-w-xs bg-gray-50 rounded-xl shadow p-2">
              <button
                onClick={loadRecords}
                className="flex-1 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                disabled={loading}
                aria-label="Refresh"
              >
                {loading ? (
                  <span className="animate-spin inline-block"><RefreshCw className="w-5 h-5" /></span>
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center font-medium text-base shadow"
              >
                <Plus className="w-4 h-4 mr-2" />
                புதிய பதிவு
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">மொத்த பதிவுகள்</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 tracking-wide">{filteredRecords.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">மொத்த தொகை</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600 tracking-wide">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">பெறப்பட்ட தொகை</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 tracking-wide">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">நிலுவைத் தொகை</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-500 tracking-wide">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>

        {/* Filters and Export */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 w-full">
              <select
                value={filter.equipment}
                onChange={(e) => setFilter(prev => ({ ...prev, equipment: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">அனைத்து வகைகள்</option>
                <option value="Cage Wheel">Cage Wheel</option>
                <option value="Rotavator">Rotavator</option>
                <option value="Dipper">Dipper</option>
                <option value="புழுதி">புழுதி</option>
                <option value="Mini">Mini</option>
              </select>

              {/* Status Filter */}
              <select
                value={filter.status}
                onChange={e => setFilter(prev => ({ ...prev, status: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">அனைத்து நிலைகள்</option>
                <option value="paid">முழுமையாக பெறப்பட்டது</option>
                <option value="pending">நிலுவையில்</option>
              </select>

              {/* Old Balance Status Filter */}
              <select
                value={filter.oldBalanceStatus}
                onChange={e => setFilter(prev => ({ ...prev, oldBalanceStatus: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
              >
                <option value="">பழைய பாக்கி நிலை</option>
                <option value="paid">பழைய பாக்கி - முழுமையாக பெறப்பட்டது</option>
                <option value="pending">பழைய பாக்கி - நிலுவையில்</option>
              </select>

              <input
                type="text"
                value={filter.name || ''}
                onChange={e => setFilter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Search rental person..."
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
              />
              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg min-w-[100px]"
              >
                Clear Filters
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => exportToExcel(filteredRecords)}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </button>
              <button
                onClick={() => exportToPDF(filteredRecords)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable records={filteredRecords} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  );
}