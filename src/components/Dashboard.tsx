import { useState, useEffect, useRef } from 'react';
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
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

  // Smooth scroll detection for header animations (mobile only)
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Only apply scroll effects on mobile devices
          if (window.innerWidth < 768) {
            const scrollTop = window.scrollY;
            // Calculate smooth scroll progress (0 to 1) over 200px scroll distance for smoother transitions
            const progress = Math.min(Math.max(scrollTop / 200, 0), 1);
            setScrollProgress(progress);
          } else {
            setScrollProgress(0);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Simple mobile detection for header behavior
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setHeaderHeight(180); // Fixed height for mobile header
    } else {
      setHeaderHeight(0);
    }
  }, []);

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
          title="Loading Dashboard - KBS Tractors"
          description="Loading KBS Tractors management dashboard..."
        />
      <div data-testid="dashboard-loading-screen" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div data-testid="dashboard-loading-content" className="text-center">
          <div data-testid="dashboard-loading-spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p data-testid="dashboard-loading-text" className="text-gray-600">தகவல்களை ஏற்றுகிறது...</p>
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
        title="Dashboard - KBS Tractors Management System"
        description="Manage your tractor rental and sales operations with KBS Tractors dashboard. Track equipment, manage rentals, and monitor business performance."
        keywords="tractor dashboard, rental management, equipment tracking, business administration, KBS Tractors dashboard"
        canonical="https://kbstractors.vercel.app/"
      />
    <div data-testid="dashboard-container" className="min-h-screen bg-gray-50 overflow-x-hidden relative">
      {/* Static Header with iOS-like animations - Mobile Only */}
      <header 
        ref={headerRef}
        data-testid="dashboard-header" 
        className="mobile-header md:relative"
        style={{
          paddingTop: window.innerWidth < 768 ? 'env(safe-area-inset-top)' : undefined,
          backgroundColor: `rgba(255, 255, 255, ${0.95 * scrollProgress})`,
          backdropFilter: `blur(${8 * scrollProgress}px)`,
          boxShadow: `0 ${4 * scrollProgress}px ${6 * scrollProgress}px -1px rgba(0, 0, 0, ${0.1 * scrollProgress})`,
          borderBottom: `1px solid rgba(229, 231, 235, ${scrollProgress})`
        }}
      >
        <div data-testid="header-content" className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-4 pb-2">
          <div data-testid="header-main" className="flex flex-col items-center">
            <img 
              data-testid="header-logo" 
              src="/icons/kbs-tractors-96.png" 
              alt="KBS Tractors Logo" 
              className="header-logo-3d rounded-full shadow mb-2 w-14 h-14 transition-all duration-300 ease-out"
              style={{
                opacity: 1 - (0.1 * scrollProgress),
                transform: `scale(${1 - (0.05 * scrollProgress)})`
              }}
            />
            <h1 
              data-testid="header-title" 
              className="header-title-3d font-bold text-gray-900 text-center text-xl sm:text-2xl transition-all duration-300 ease-out"
              style={{
                opacity: 1 - (0.1 * scrollProgress),
                transform: `scale(${1 - (0.02 * scrollProgress)})`
              }}
            >
              KBS Tractors
            </h1>
            <p 
              data-testid="header-subtitle" 
              className="header-subtitle-3d text-gray-600 text-center mb-4 text-xs sm:text-sm transition-all duration-300 ease-out"
              style={{
                opacity: 1 - (0.3 * scrollProgress)
              }}
            >
              நிர்வாக பேனல்
            </p>
            <div 
              data-testid="header-actions" 
              className="header-actions-3d flex flex-row items-center justify-center gap-3 w-full max-w-xs rounded-xl shadow p-2 bg-gray-50 transition-all duration-300 ease-out"
              style={{
                backgroundColor: `rgba(249, 250, 251, ${0.5 + (0.3 * scrollProgress)})`,
                backdropFilter: `blur(${4 * scrollProgress}px)`,
                opacity: 1 - (0.1 * scrollProgress)
              }}
            >
              <button
                data-testid="refresh-button"
                onClick={loadRecords}
                className="header-button-3d flex-1 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors duration-200"
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
                className="header-button-primary-3d flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center font-medium text-base shadow transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus data-testid="add-icon" className="w-4 h-4 mr-2" />
                <span data-testid="add-button-text">புதிய பதிவு</span>
              </button>
              <button
                data-testid="logout-button"
                onClick={handleLogout}
                className="header-button-3d flex-1 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors duration-200"
                aria-label="Logout"
              >
                <LogOut data-testid="logout-icon" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div 
        data-testid="dashboard-main-content" 
        className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 md:pt-4 md:py-8 mobile-content"
      >
        {/* Stats Cards */}
        <div data-testid="stats-cards" className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
          <div data-testid="total-records-card" className="dashboard-card">
            <div data-testid="total-records-content" className="dashboard-card-content">
              <p data-testid="total-records-label" className="dashboard-card-label">மொத்த பதிவுகள்</p>
              <p data-testid="total-records-value" className="dashboard-card-value blue">{filteredRecords.length}</p>
            </div>
          </div>
          <div data-testid="total-amount-card" className="dashboard-card">
            <div data-testid="total-amount-content" className="dashboard-card-content">
              <p data-testid="total-amount-label" className="dashboard-card-label">மொத்த தொகை</p>
              <p data-testid="total-amount-value" className="dashboard-card-value orange">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
          <div data-testid="total-received-card" className="dashboard-card">
            <div data-testid="total-received-content" className="dashboard-card-content">
              <p data-testid="total-received-label" className="dashboard-card-label">பெறப்பட்ட தொகை</p>
              <p data-testid="total-received-value" className="dashboard-card-value green">{formatCurrency(totalReceived)}</p>
            </div>
          </div>
          <div data-testid="pending-amount-card" className="dashboard-card">
            <div data-testid="pending-amount-content" className="dashboard-card-content">
              <p data-testid="pending-amount-label" className="dashboard-card-label">நிலுவைத் தொகை</p>
              <p data-testid="pending-amount-value" className="dashboard-card-value red">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filters and Export */}
        <div data-testid="filters-section" className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div data-testid="filters-content" className="flex flex-wrap gap-3 items-center justify-between">
            <div data-testid="filters-row" className="flex flex-wrap gap-3 w-full">
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
            <div data-testid="export-buttons" className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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