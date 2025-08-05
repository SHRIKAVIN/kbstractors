import{ useState, useEffect } from 'react';
import { Plus, Download,LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { rentalService } from '../lib/supabase';
import { RentalForm } from './RentalForm';
import { DataTable } from './DataTable';
import { SEO } from './SEO';
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
  const [showFilters, setShowFilters] = useState(false);
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
      <>
        <SEO 
          title="KBS Tractors - Loading Dashboard"
          description="KBS Tractors - Professional tractor rental and sales management system. Loading your dashboard..."
        />
      <div data-testid="dashboard-loading-screen" className="min-h-screen bg-white flex items-center justify-center">
        <div data-testid="dashboard-loading-content" className="text-center transform hover:scale-105 transition-transform duration-300">
          <div data-testid="dashboard-loading-spinner" className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4 shadow-2xl"></div>
          <p data-testid="dashboard-loading-text" className="text-gray-600 font-medium">தகவல்களை ஏற்றுகிறது...</p>
        </div>
      </div>
      </>
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
    <>
      <SEO 
        title="KBS Tractors - Dashboard"
        description="KBS Tractors - Professional tractor rental and sales management dashboard. Manage equipment, track rentals, and monitor business performance efficiently."
        keywords="KBS Tractors dashboard, KBS management, tractor rental management, equipment tracking, business administration, KBS equipment"
        canonical="https://kbstractors.vercel.app/"
      />
    <div data-testid="dashboard-container" className="min-h-screen bg-white">
      {/* Header with 3D Effects */}
      <header data-testid="dashboard-header" className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-2xl transform-gpu">
        <div data-testid="header-content" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6">
          <div data-testid="header-main" className="flex flex-col items-center">
            {/* Logo with 3D Effect */}
            <div className="relative transform hover:scale-110 transition-all duration-300 hover:rotate-3">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-60 transform scale-110"></div>
              <img data-testid="header-logo" src="/icons/kbs-tractors-96.png" alt="KBS Tractors Logo" className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl border-4 border-white/20 backdrop-blur-sm" />
            </div>
            
            {/* Title with 3D Text Effect */}
            <div className="mt-3 text-center">
              <h1 data-testid="header-title" className="text-xl sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">KBS Tractors</span>
              </h1>
              <p data-testid="header-subtitle" className="text-xs sm:text-sm lg:text-base text-blue-100 mt-1 font-medium drop-shadow-lg">நிர்வாக பேனல்</p>
            </div>
            
            {/* Action Buttons with 3D Card Effect */}
            <div data-testid="header-actions" className="mt-4 flex flex-row items-center justify-center gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-2 sm:p-3 transform hover:scale-105 transition-all duration-300">
              <button
                data-testid="refresh-button"
                onClick={loadRecords}
                className="flex-1 text-white hover:text-blue-100 p-2 sm:p-3 rounded-xl hover:bg-white/20 flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                disabled={loading}
                aria-label="Refresh"
              >
                {loading ? (
                  <span data-testid="refresh-loading-icon" className="animate-spin inline-block"><RefreshCw className="w-5 h-5" /></span>
                ) : (
                  <RefreshCw data-testid="refresh-icon" className="w-5 h-5" />
                )}
              </button>
              <button
                data-testid="add-record-button"
                onClick={() => setShowForm(true)}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center justify-center font-medium text-sm sm:text-base shadow-2xl transform hover:scale-105 hover:shadow-2xl transition-all duration-200 border border-green-400/30"
              >
                <Plus data-testid="add-icon" className="w-4 h-4 mr-2" />
                <span data-testid="add-button-text">புதிய பதிவு</span>
              </button>
              <button
                data-testid="logout-button"
                onClick={handleLogout}
                className="flex-1 text-white hover:text-red-100 p-2 sm:p-3 rounded-xl hover:bg-red-500/20 flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                aria-label="Logout"
              >
                <LogOut data-testid="logout-icon" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div data-testid="dashboard-main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
        {/* Stats Cards with 3D Effects */}
        <div data-testid="stats-cards" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-6 sm:mb-8">
          <div data-testid="total-records-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-blue-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="total-records-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">மொத்த பதிவுகள்</p>
              <p data-testid="total-records-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{filteredRecords.length}</p>
            </div>
          </div>
          
          <div data-testid="total-amount-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-green-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="total-amount-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">மொத்த தொகை</p>
              <p data-testid="total-amount-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
          
          <div data-testid="total-received-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-blue-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="total-received-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">பெறப்பட்ட தொகை</p>
              <p data-testid="total-received-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(totalReceived)}</p>
            </div>
          </div>
          
          <div data-testid="pending-amount-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-orange-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="pending-amount-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">நிலுவைத் தொகை</p>
              <p data-testid="pending-amount-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filter Toggle Button - Mobile Only */}
        <div className="mb-4 flex justify-center md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
          >
            {showFilters ? (
              <>
                <span>Hide Filters</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Show Filters</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Filters and Export */}
        <div data-testid="filters-section" className={`bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6 mb-6 sm:mb-8 ${showFilters ? 'block' : 'hidden md:block'}`}>
                      <div data-testid="filters-content" className="flex flex-wrap gap-3 items-center justify-between">
            <div data-testid="filters-row" className="flex flex-wrap gap-2 sm:gap-3 w-full">
              <select
                data-testid="equipment-filter"
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
                data-testid="status-filter"
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
                data-testid="old-balance-status-filter"
                value={filter.oldBalanceStatus}
                onChange={e => setFilter(prev => ({ ...prev, oldBalanceStatus: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
              >
                <option value="">பழைய பாக்கி நிலை</option>
                <option value="paid">பழைய பாக்கி - முழுமையாக பெறப்பட்டது</option>
                <option value="pending">பழைய பாக்கி - நிலுவையில்</option>
              </select>

              <input
                data-testid="name-search-input"
                type="text"
                value={filter.name || ''}
                onChange={e => setFilter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Search rental person..."
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
              />
              <button
                data-testid="clear-filters-button"
                onClick={handleClearFilters}
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg min-w-[100px]"
              >
                Clear Filters
              </button>
            </div>
            <div data-testid="export-buttons" className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-4 sm:mt-0">
              <button
                data-testid="export-excel-button"
                onClick={() => exportToExcel(filteredRecords)}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              >
                <Download data-testid="excel-icon" className="w-4 h-4 mr-2" />
                <span data-testid="excel-button-text">Excel</span>
              </button>
              <button
                data-testid="export-pdf-button"
                onClick={() => exportToPDF(filteredRecords)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              >
                <Download data-testid="pdf-icon" className="w-4 h-4 mr-2" />
                <span data-testid="pdf-button-text">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable records={filteredRecords} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
    </>
  );
}