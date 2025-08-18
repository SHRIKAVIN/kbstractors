import{ useState, useEffect } from 'react';
import { Plus, Download, RefreshCw, Truck } from 'lucide-react';
import { jcbService } from '../lib/jcb-supabase';
import { JCBForm } from './JCBForm';
import { JCBDataTable } from './JCBDataTable';
import { ConfirmDialog } from './ConfirmDialog';
import { SEO } from './SEO';
import type { JCBRecord } from '../types/jcb';
import { formatCurrency } from '../utils/jcb-calculations';

interface JCBDashboardProps {
  onBackToTractor: () => void;
}

export function JCBDashboard({ onBackToTractor }: JCBDashboardProps) {
  const [records, setRecords] = useState<JCBRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<JCBRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    equipment: '',
    dateFrom: '',
    dateTo: '',
    company: '',
    status: '',
    oldBalanceStatus: '',
  });
  const [editRecord, setEditRecord] = useState<JCBRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; record: JCBRecord | null }>({ isOpen: false, record: null });

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, filter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await jcbService.getAll();
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
        record.details.some(d => d.equipment_type === filter.equipment)
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

    if (filter.company) {
      filtered = filtered.filter(record => record.company_name.toLowerCase().includes(filter.company.toLowerCase()));
    }

    if (filter.status) {
      filtered = filtered.filter(record => {
        let status;
        if (record.old_balance_status) {
          status = record.old_balance_status;
        } else if (record.amount_received !== undefined) {
          status = (record.amount_received >= record.total_amount) ? 'paid' : 'pending';
        } else {
          status = 'pending';
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

  const handleRecordAdded = (newRecord: JCBRecord) => {
    setRecords(prev => [newRecord, ...prev]);
    setShowForm(false);
  };

  const handleEdit = (record: JCBRecord) => {
    setEditRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (record: JCBRecord) => {
    setDeleteDialog({ isOpen: true, record });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.record) return;
    
    try {
      await jcbService.delete(deleteDialog.record.id);
      setRecords(prev => prev.filter(r => r.id !== deleteDialog.record!.id));
      setDeleteDialog({ isOpen: false, record: null });
    } catch (error) {
      alert('Failed to delete record from database.');
      console.error(error);
    }
  };

  const handleClearFilters = () => {
    setFilter({ equipment: '', dateFrom: '', dateTo: '', company: '', status: '', oldBalanceStatus: '' });
  };

  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.total_amount, 0);
  const totalReceived = filteredRecords.reduce((sum, record) => sum + (record.amount_received || 0), 0);
  const pendingAmount = totalAmount - totalReceived;

  if (loading) {
    return (
      <>
        <SEO 
          title="KBS JCB - Loading Dashboard"
          description="KBS JCB - Professional JCB rental and services management system. Loading your dashboard..."
        />
      <div data-testid="jcb-dashboard-loading-screen" className="min-h-screen bg-white flex items-center justify-center">
        <div data-testid="jcb-dashboard-loading-content" className="text-center transform hover:scale-105 transition-transform duration-300">
          <div data-testid="jcb-dashboard-loading-spinner" className="animate-spin rounded-full h-16 w-16 border-4 border-orange-600 border-t-transparent mx-auto mb-4 shadow-2xl"></div>
          <p data-testid="jcb-dashboard-loading-text" className="text-gray-600 font-medium">JCB தகவல்களை ஏற்றுகிறது...</p>
        </div>
      </div>
      </>
    );
  }

  if (showForm && editRecord) {
    return <JCBForm onClose={() => { setShowForm(false); setEditRecord(null); }} onSave={async (updated) => {
      try {
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
    return <JCBForm onClose={() => setShowForm(false)} onSave={handleRecordAdded} />;
  }

  return (
    <>
      <SEO 
        title="KBS JCB - Dashboard"
        description="KBS JCB - Professional JCB rental and services management dashboard. Manage equipment, track rentals, and monitor business performance efficiently."
        keywords="KBS JCB dashboard, KBS JCB management, JCB rental management, equipment tracking, business administration, KBS JCB equipment"
        canonical="https://kbstractors.vercel.app/jcb"
      />
    <div data-testid="jcb-dashboard-container" className="min-h-screen bg-white">
      {/* Header with 3D Effects */}
      <header data-testid="jcb-dashboard-header" className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-red-800 shadow-2xl transform-gpu">
        <div data-testid="jcb-header-content" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6">
          <div data-testid="jcb-header-main" className="flex flex-col items-center relative">
            {/* Tractor Button - Top Right */}
            <button
              data-testid="jcb-back-button"
              onClick={onBackToTractor}
              className="absolute top-0 right-0 text-white hover:text-orange-100 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all duration-200 transform hover:scale-110 hover:shadow-lg backdrop-blur-md border border-white/20"
              aria-label="Back to Tractor"
            >
              <Truck className="w-4 h-4" />
            </button>
            
            {/* Logo with 3D Effect */}
            <div className="relative transform hover:scale-110 transition-all duration-300 hover:rotate-3">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-60 transform scale-110"></div>
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl border-4 border-white/20 backdrop-blur-sm bg-orange-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">JCB</span>
              </div>
            </div>
            
            {/* Title with 3D Text Effect */}
            <div className="mt-3 text-center">
              <h1 data-testid="jcb-header-title" className="text-xl sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <span className="bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-transparent">KBS JCB Services</span>
              </h1>
              <p data-testid="jcb-header-subtitle" className="text-xs sm:text-sm lg:text-base text-orange-100 mt-1 font-medium drop-shadow-lg">JCB நிர்வாக பேனல்</p>
            </div>
            
            {/* Action Buttons with 3D Card Effect */}
            <div data-testid="jcb-header-actions" className="mt-4 flex flex-row items-center justify-center gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-2 sm:p-3 transform hover:scale-105 transition-all duration-300">
              <button
                data-testid="jcb-refresh-button"
                onClick={loadRecords}
                className="flex-1 text-white hover:text-orange-100 p-2 sm:p-3 rounded-xl hover:bg-white/20 flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                disabled={loading}
                aria-label="Refresh"
              >
                {loading ? (
                  <span data-testid="jcb-refresh-loading-icon" className="animate-spin inline-block"><RefreshCw className="w-5 h-5" /></span>
                ) : (
                  <RefreshCw data-testid="jcb-refresh-icon" className="w-5 h-5" />
                )}
              </button>
              <button
                data-testid="jcb-add-record-button"
                onClick={() => setShowForm(true)}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center justify-center font-medium text-sm sm:text-base shadow-2xl transform hover:scale-105 hover:shadow-2xl transition-all duration-200 border border-green-400/30"
              >
                <Plus data-testid="jcb-add-icon" className="w-4 h-4 mr-2" />
                <span data-testid="jcb-add-button-text">புதிய JCB பதிவு</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div data-testid="jcb-dashboard-main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
        {/* Stats Cards with 3D Effects */}
        <div data-testid="jcb-stats-cards" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-6 sm:mb-8">
          <div data-testid="jcb-total-records-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-orange-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="jcb-total-records-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">மொத்த JCB பதிவுகள்</p>
              <p data-testid="jcb-total-records-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{filteredRecords.length}</p>
            </div>
          </div>
          
          <div data-testid="jcb-total-amount-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-green-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="jcb-total-amount-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">மொத்த தொகை</p>
              <p data-testid="jcb-total-amount-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
          
          <div data-testid="jcb-total-received-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-blue-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="jcb-total-received-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">பெறப்பட்ட தொகை</p>
              <p data-testid="jcb-total-received-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(totalReceived)}</p>
            </div>
          </div>
          
          <div data-testid="jcb-pending-amount-card" className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center text-center border border-orange-100/50 backdrop-blur-sm relative overflow-hidden">
            <div className="relative">
              <p data-testid="jcb-pending-amount-label" className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">நிலுவைத் தொகை</p>
              <p data-testid="jcb-pending-amount-value" className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-wide drop-shadow-sm">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filter Toggle Button - Mobile Only */}
        <div className="mb-4 flex justify-center md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
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

        {/* Filters */}
        <div data-testid="jcb-filters-section" className={`bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6 mb-6 sm:mb-8 ${showFilters ? 'block' : 'hidden md:block'}`}>
          <div data-testid="jcb-filters-content" className="flex flex-wrap gap-3 items-center justify-between">
            <div data-testid="jcb-filters-row" className="flex flex-wrap gap-2 sm:gap-3 w-full">
              <select
                data-testid="jcb-equipment-filter"
                value={filter.equipment}
                onChange={(e) => setFilter(prev => ({ ...prev, equipment: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">அனைத்து வகைகள்</option>
                <option value="JCB">JCB</option>
                <option value="Excavator">Excavator</option>
                <option value="Loader">Loader</option>
              </select>

              {/* Status Filter */}
              <select
                data-testid="jcb-status-filter"
                value={filter.status}
                onChange={e => setFilter(prev => ({ ...prev, status: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">அனைத்து நிலைகள்</option>
                <option value="paid">முழுமையாக பெறப்பட்டது</option>
                <option value="pending">நிலுவையில்</option>
              </select>

              {/* Old Balance Status Filter */}
              <select
                data-testid="jcb-old-balance-status-filter"
                value={filter.oldBalanceStatus}
                onChange={e => setFilter(prev => ({ ...prev, oldBalanceStatus: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[180px]"
              >
                <option value="">பழைய பாக்கி நிலை</option>
                <option value="paid">பழைய பாக்கி - முழுமையாக பெறப்பட்டது</option>
                <option value="pending">பழைய பாக்கி - நிலுவையில்</option>
              </select>

              <input
                data-testid="jcb-company-search-input"
                type="text"
                value={filter.company || ''}
                onChange={e => setFilter(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Search JCB company..."
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[160px]"
              />
              <button
                data-testid="jcb-clear-filters-button"
                onClick={handleClearFilters}
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg min-w-[100px]"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* JCB Data Table */}
        <JCBDataTable records={filteredRecords} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>

    {/* Custom Delete Confirmation Dialog */}
    <ConfirmDialog
      isOpen={deleteDialog.isOpen}
      onClose={() => setDeleteDialog({ isOpen: false, record: null })}
      onConfirm={confirmDelete}
      title="KBS JCB"
      message="Are you sure you want to delete this JCB record?"
      confirmText="Delete"
      cancelText="Cancel"
    />
    </>
  );
}
