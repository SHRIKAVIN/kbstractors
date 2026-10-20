import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, LogOut, RefreshCw, Construction, Search, SlidersHorizontal, Tractor, X, Trash2, Check, MoreHorizontal, UserCog, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { rentalService } from '../lib/supabase';
import { RentalForm } from './RentalForm';
import { SEO } from './SEO';
import { JCBDashboard } from './JCBDashboard';
import { PushToggleButton } from './PushToggleButton';
import { UserControlScreen } from './userControl/UserControlScreen';
import { RentalRow } from './rental/RentalRow';
import { CollectSheet } from './rental/CollectSheet';
import { BottomSheet } from './rental/BottomSheet';
import { FilterSheet } from './rental/FilterSheet';
import { EMPTY_FILTERS, filterRentals, type RentalFilters } from './rental/rentalFilters';
import { ProgressRing, useCountUp } from './rental/motion';
import { dayLabel, rentalStatus } from './rental/rentalDisplay';
import type { RentalRecord } from '../types/rental';
import { exportToExcel, exportToPDF } from '../utils/export';
import { formatCurrency } from '../utils/calculations';
import { getRentalPending } from '../utils/pending';
import { RECORDS_CHANGED_EVENT } from '../lib/liveEvents';


const STATUS_TABS = [
  { value: '', label: 'அனைத்தும்' },
  { value: 'pending', label: 'நிலுவை' },
  { value: 'paid', label: 'பெறப்பட்டது' },
] as const;

const iconButton =
  'kbs-press grid h-10 w-10 place-items-center rounded-full bg-line/[0.06] text-fog/80 ring-1 ring-inset ring-line/10 hover:bg-line/10 hover:text-fog';

/**
 * Paints the browser chrome (theme-color, overscroll and the area under the
 * iOS status bar) to match the screen. iOS home-screen apps draw a blurred
 * fade under the status bar from the page background — if that's left white
 * on any screen, you get a light smear above the header. Every screen uses
 * the app colour (following light/dark), except JCB, which keeps its own
 * white page.
 */
function usePageChrome(mode: 'app' | 'jcb') {
  useEffect(() => {
    const root = document.documentElement;
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const prevMetas = metas.map((m) => m.content);
    const prevBg = root.style.backgroundColor;
    const restore = () => {
      metas.forEach((m, i) => (m.content = prevMetas[i]));
      root.style.backgroundColor = prevBg;
    };

    if (mode === 'jcb') {
      root.style.backgroundColor = '#ffffff';
      return restore;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const rgb = getComputedStyle(root).getPropertyValue('--night-950').trim();
      const color = `rgb(${rgb.split(/\s+/).join(', ')})`;
      metas.forEach((m) => (m.content = color));
      root.style.backgroundColor = color;
    };
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      restore();
    };
  }, [mode]);
}

export function Dashboard() {
  const [currentView, setCurrentView] = useState<'tractor' | 'jcb' | 'users'>('tractor');
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<RentalFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<RentalRecord | null>(null);
  const [collectRecord, setCollectRecord] = useState<RentalRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<RentalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const stickySentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const { signOut, can, profile } = useAuth();
  const canReadTractor = can('tractor', 'read');
  const canReadJcb = can('jcb', 'read');

  // A JCB-only login lands straight on JCB.
  const routedRef = useRef(false);
  useEffect(() => {
    if (routedRef.current || !profile) return;
    routedRef.current = true;
    if (!canReadTractor && canReadJcb) setCurrentView('jcb');
  }, [profile, canReadTractor, canReadJcb]);

  usePageChrome(currentView === 'jcb' && canReadJcb ? 'jcb' : 'app');

  // The form and other screens replace the list in place, so the window keeps
  // the list's scroll offset. Open each screen at the top and put the list back
  // where it was on return.
  const listScrollY = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const onList = currentView === 'tractor' && !showForm;
  useLayoutEffect(() => {
    if (!onList) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo(0, listScrollY.current);
    const remember = () => {
      listScrollY.current = window.scrollY;
      setScrolled(window.scrollY > 0);
    };
    remember();
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [onList]);

  // The search bar only gets its frosted background once it is pinned to the top.
  useEffect(() => {
    const el = stickySentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [currentView, showForm]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loadRecords = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const data = await rentalService.getAll();
      setRecords(data);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRecordsRef = useRef(loadRecords);
  loadRecordsRef.current = loadRecords;

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    const onChange = () => {
      void loadRecordsRef.current({ silent: true });
    };
    window.addEventListener(RECORDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(RECORDS_CHANGED_EVENT, onChange);
  }, []);

  // Everything except the paid/pending status — so the status tabs can show counts.
  const baseFiltered = useMemo(() => filterRentals(records, { ...filters, status: '' }), [records, filters]);

  const statusCounts = useMemo(() => {
    let paid = 0;
    for (const r of baseFiltered) if (getRentalPending(r).isPaid) paid += 1;
    return { '': baseFiltered.length, paid, pending: baseFiltered.length - paid } as Record<string, number>;
  }, [baseFiltered]);

  const filteredRecords = useMemo(() => filterRentals(records, filters), [records, filters]);

  const groups = useMemo(() => {
    const out: { label: string; items: RentalRecord[] }[] = [];
    for (const r of filteredRecords) {
      const label = dayLabel(r.created_at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [filteredRecords]);

  const totals = useMemo(() => {
    let total = 0;
    let received = 0;
    let pending = 0;
    for (const r of filteredRecords) {
      total += r.total_amount;
      received += r.received_amount || 0;
      pending += rentalStatus(r).pending;
    }
    return { total, received, pending, progress: total > 0 ? Math.min(100, (received / total) * 100) : 0 };
  }, [filteredRecords]);

  const animatedPending = useCountUp(loading ? 0 : totals.pending);
  const animatedTotal = useCountUp(loading ? 0 : totals.total);
  const animatedReceived = useCountUp(loading ? 0 : totals.received);

  const advancedFilterCount = (filters.equipment ? 1 : 0) + (filters.oldBalanceStatus ? 1 : 0);
  const tabIndex = STATUS_TABS.findIndex((t) => t.value === filters.status);

  const closeForm = () => {
    setShowForm(false);
    setEditRecord(null);
  };

  const confirmDelete = async () => {
    if (!deleteRecord) return;
    setDeleting(true);
    try {
      await rentalService.delete(deleteRecord);
      setRecords((prev) => prev.filter((r) => r.id !== deleteRecord.id));
      setDeleteRecord(null);
      showToast('பதிவு நீக்கப்பட்டது');
    } catch (error) {
      console.error(error);
      showToast('நீக்க முடியவில்லை — மீண்டும் முயற்சிக்கவும்');
    } finally {
      setDeleting(false);
    }
  };

  if (currentView === 'jcb' && canReadJcb) {
    return <JCBDashboard onBackToTractor={() => setCurrentView('tractor')} />;
  }

  if (currentView === 'users' && profile?.isOwner) {
    return <UserControlScreen onBack={() => setCurrentView('tractor')} />;
  }

  if (!canReadTractor) {
    return (
      <div className="kbs-app kbs-grain relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-line/[0.05] ring-1 ring-line/10">
          <Lock className="h-8 w-8 text-fog/40" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 text-[20px] font-semibold tracking-tight">அனுமதி இல்லை</h1>
        <p className="mt-2 max-w-xs text-[14px] text-fog/50">
          {profile?.name ? `${profile.name}, ` : ''}இந்தப் பகுதியைப் பார்க்க உங்களுக்கு அனுமதி இல்லை. உரிமையாளரைத் தொடர்பு கொள்ளவும்.
        </p>
        <div className="mt-8 flex gap-3">
          {canReadJcb && (
            <button
              type="button"
              onClick={() => setCurrentView('jcb')}
              className="kbs-press inline-flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-brand-fg"
            >
              <Construction className="h-4 w-4" />
              JCB
            </button>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="kbs-press inline-flex h-12 items-center gap-2 rounded-full bg-line/[0.06] px-5 text-[14px] font-medium text-fog/80 ring-1 ring-inset ring-line/10"
          >
            <LogOut className="h-4 w-4" />
            வெளியேறு
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <RentalForm
        initialData={editRecord ?? undefined}
        onClose={closeForm}
        onSave={(saved) => {
          setRecords((prev) => (editRecord ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
          showToast(editRecord ? 'பதிவு புதுப்பிக்கப்பட்டது' : 'புதிய பதிவு சேர்க்கப்பட்டது');
          closeForm();
        }}
      />
    );
  }

  let rowIndex = 0;

  return (
    <>
      <SEO
        title="KBS Tractors - Dashboard"
        description="KBS Tractors - Professional tractor rental and sales management dashboard. Manage equipment, track rentals, and monitor business performance efficiently."
        keywords="KBS Tractors dashboard, KBS management, tractor rental management, equipment tracking, business administration, KBS equipment"
        canonical="https://kbstractors.vercel.app/"
      />
      <div data-testid="dashboard-container" className="kbs-app kbs-grain relative min-h-screen overflow-x-clip pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-pos/[0.13] blur-[100px]" />
        <div className="pointer-events-none absolute -right-40 top-24 h-[360px] w-[360px] rounded-full bg-coral-500/[0.08] blur-[110px]" />

        <header data-testid="dashboard-header" className="relative z-10 mx-auto max-w-5xl px-5 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
          <div className="flex items-center gap-3">
            <img
              data-testid="header-logo"
              src="/icons/kbs-tractors-96.png"
              alt="KBS Tractors"
              className="h-10 w-10 rounded-full ring-1 ring-line/15"
            />
            <div className="min-w-0 flex-1">
              <h1 data-testid="header-title" className="truncate text-[16px] font-semibold tracking-tight">KBS Tractors</h1>
              <p className="text-[12px] text-fog/45">வாடகை கணக்கு</p>
            </div>
            <PushToggleButton className="!rounded-full !p-[11px] !bg-line/[0.06] !border-line/10 !text-fog/80 hover:!scale-100" />
            <button
              type="button"
              data-testid="refresh-button"
              onClick={() => void loadRecords()}
              disabled={refreshing}
              className={iconButton}
              aria-label="Refresh"
            >
              <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className={iconButton} aria-label="More" aria-expanded={menuOpen}>
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 origin-top-right animate-pop-in overflow-hidden rounded-2xl bg-night-800/95 p-1.5 shadow-[0_20px_60px_-10px_rgb(var(--shade)/var(--shade-a))] ring-1 ring-line/10 backdrop-blur-xl">
                    {profile && (
                      <div className="mb-1 border-b border-line/[0.06] px-3 pb-2.5 pt-2">
                        <p className="truncate text-[14px] font-semibold">{profile.name}</p>
                        <p className="truncate text-[12px] text-fog/45">@{profile.username}</p>
                      </div>
                    )}
                    {profile?.isOwner && (
                      <button
                        type="button"
                        data-testid="user-control-button"
                        onClick={() => {
                          setMenuOpen(false);
                          setCurrentView('users');
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fog/85 hover:bg-line/[0.06]"
                      >
                        <UserCog className="h-4 w-4 text-fog/50" />
                        User control
                      </button>
                    )}
                    {canReadJcb && (
                    <button
                      type="button"
                      data-testid="jcb-switch-button"
                      onClick={() => {
                        setMenuOpen(false);
                        setCurrentView('jcb');
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fog/85 hover:bg-line/[0.06]"
                    >
                      <Construction className="h-4 w-4 text-fog/50" />
                      JCB
                    </button>
                    )}
                    <button
                      type="button"
                      data-testid="logout-button"
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-coral-300 hover:bg-coral-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      வெளியேறு
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Hero */}
          <section className="mt-9 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] text-fog/50">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-coral-400" />
                </span>
                மொத்த நிலுவை
                {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-fog/40" />}
              </p>
              <p data-testid="pending-amount-value" className="mt-3 flex items-baseline font-semibold leading-none tracking-[-0.045em]">
                <span className="mr-1 text-[28px] font-light text-fog/35">₹</span>
                <span className="bg-gradient-to-b from-fog to-fog/60 bg-clip-text text-[clamp(44px,13vw,64px)] text-transparent">
                  {animatedPending.toLocaleString('en-IN')}
                </span>
              </p>
            </div>
            <ProgressRing percent={loading ? 0 : totals.progress} size={84} stroke={6}>
              <div className="text-center leading-none">
                <p className="text-[19px] font-semibold tracking-tight">{Math.round(totals.progress)}<span className="text-[12px] text-fog/50">%</span></p>
                <p className="mt-1 text-[9.5px] uppercase tracking-[0.12em] text-fog/40">வசூல்</p>
              </div>
            </ProgressRing>
          </section>

          <dl data-testid="stats-cards" className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-3xl bg-line/[0.06] ring-1 ring-inset ring-line/[0.06]">
            {[
              { label: 'பதிவுகள்', value: String(filteredRecords.length), testId: 'total-records-value', tone: 'text-fog' },
              { label: 'மொத்தம்', value: formatCurrency(animatedTotal), testId: 'total-amount-value', tone: 'text-fog' },
              { label: 'பெறப்பட்டது', value: formatCurrency(animatedReceived), testId: 'total-received-value', tone: 'text-pos' },
            ].map((s) => (
              <div key={s.label} className="bg-night-900/80 px-4 py-4 backdrop-blur">
                <dt className="text-[11.5px] text-fog/45">{s.label}</dt>
                <dd data-testid={s.testId} className={`mt-1.5 truncate text-[16px] font-semibold tracking-tight ${s.tone}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* Search + status — sticks under the status bar */}
        {/* Hides the list behind the status bar once scrolled; off at the top so the glow shows through. */}
        <div
          className={`fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-night-950 transition-opacity duration-200 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div ref={stickySentinel} className="h-6" />
        <div
          className={`sticky top-[env(safe-area-inset-top)] z-30 transition-colors duration-300 ${
            stuck ? 'bg-night-950/80 shadow-[0_1px_0_rgb(var(--line)/0.08)] backdrop-blur-2xl' : ''
          }`}
        >
          <div className="mx-auto max-w-5xl px-5 pb-3 pt-3 sm:px-8">
            <div className="flex gap-2">
              <label className="flex h-12 flex-1 items-center gap-2.5 rounded-full bg-line/[0.05] px-4 ring-1 ring-inset ring-line/[0.08] transition focus-within:bg-line/[0.07] focus-within:ring-pos/50">
                <Search className="h-[18px] w-[18px] shrink-0 text-fog/40" />
                <input
                  data-testid="name-search-input"
                  type="search"
                  value={filters.name}
                  onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="பெயரைத் தேடு"
                  className="w-full bg-transparent text-[15px] text-fog outline-none placeholder:text-fog/30 [&::-webkit-search-cancel-button]:hidden"
                />
                {filters.name && (
                  <button type="button" onClick={() => setFilters((prev) => ({ ...prev, name: '' }))} aria-label="Clear search">
                    <X className="h-4 w-4 text-fog/40" />
                  </button>
                )}
              </label>
              <button
                type="button"
                data-testid="filters-button"
                onClick={() => setShowFilters(true)}
                className="kbs-press relative grid h-12 w-12 place-items-center rounded-full bg-line/[0.05] text-fog/70 ring-1 ring-inset ring-line/[0.08]"
                aria-label="Filters and export"
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" />
                {advancedFilterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-fg ring-2 ring-night-950">
                    {advancedFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="relative mt-3 grid grid-cols-3 rounded-full bg-line/[0.04] p-1 ring-1 ring-inset ring-line/[0.06]">
              <span
                className="absolute bottom-1 left-1 top-1 rounded-full bg-fog shadow-[0_4px_20px_-4px_rgb(var(--fog)/0.22)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${tabIndex * 100}%)` }}
              />
              {STATUS_TABS.map((tab) => {
                const active = filters.status === tab.value;
                return (
                  <button
                    key={tab.value || 'all'}
                    type="button"
                    data-testid={`status-chip-${tab.value || 'all'}`}
                    onClick={() => setFilters((prev) => ({ ...prev, status: tab.value }))}
                    className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition-colors duration-300 ${
                      active ? 'text-night-950' : 'text-fog/55'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[11px] ${active ? 'text-night-950/50' : 'text-fog/30'}`}>{statusCounts[tab.value]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Records */}
        <main className="relative z-10 mx-auto max-w-5xl px-5 sm:px-8">
          {loading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="kbs-surface h-[104px] animate-pulse rounded-[26px]" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div data-testid="empty-state" className="flex flex-col items-center px-6 py-20 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-line/[0.04] ring-1 ring-line/10">
                <Tractor className="h-9 w-9 text-fog/40" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold tracking-tight">பதிவுகள் இல்லை</h3>
              <p className="mt-1.5 max-w-xs text-[14px] text-fog/45">
                {records.length ? 'இந்த வடிகட்டிக்குப் பொருந்தும் பதிவுகள் இல்லை' : 'முதல் வாடகை பதிவைச் சேர்க்கவும்'}
              </p>
              {records.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="kbs-press mt-6 rounded-full bg-line/[0.06] px-5 py-2.5 text-[13px] font-medium text-fog/80 ring-1 ring-inset ring-line/10"
                >
                  வடிகட்டிகளை அழி
                </button>
              )}
            </div>
          ) : (
            <div data-testid="rental-list">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="flex items-center gap-3 pb-3 pt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">
                    {group.label}
                    <span className="h-px flex-1 bg-gradient-to-r from-line/10 to-transparent" />
                    <span className="normal-case tracking-normal text-fog/30">{group.items.length}</span>
                  </h2>
                  <div className="grid items-start gap-3 md:grid-cols-2">
                    {group.items.map((record) => (
                      <RentalRow
                        key={record.id}
                        record={record}
                        index={rowIndex++}
                        onCollect={can('tractor', 'collect') || can('tractor', 'update') ? setCollectRecord : undefined}
                        onEdit={
                          can('tractor', 'update')
                            ? (r) => {
                                setEditRecord(r);
                                setShowForm(true);
                              }
                            : undefined
                        }
                        onDelete={can('tractor', 'delete') ? setDeleteRecord : undefined}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        {/* New entry */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-32 bg-gradient-to-t from-night-950 via-night-950/80 to-transparent" />
        {can('tractor', 'create') && (
        <button
          type="button"
          data-testid="add-record-button"
          onClick={() => {
            setEditRecord(null);
            setShowForm(true);
          }}
          className="kbs-press fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 inline-flex h-[60px] -translate-x-1/2 items-center gap-2.5 rounded-full bg-brand pl-5 pr-7 text-[15px] font-semibold text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.1),0_16px_40px_-8px_rgb(var(--brand)/0.55)] hover:bg-brand-hover"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-fg text-brand">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.75} />
          </span>
          புதிய பதிவு
        </button>
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 animate-toast-in items-center gap-2.5 whitespace-nowrap rounded-full bg-night-700/95 py-2.5 pl-2.5 pr-4 text-[13.5px] font-medium text-fog shadow-[0_20px_50px_-10px_rgb(var(--shade)/var(--shade-a))] ring-1 ring-line/10 backdrop-blur-xl"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-fg">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            {toast}
          </div>
        )}
      </div>

      <CollectSheet
        record={collectRecord}
        onClose={() => setCollectRecord(null)}
        onCollected={(updated) => {
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
      />

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={setFilters}
        records={records}
        onExportExcel={exportToExcel}
        onExportPdf={exportToPDF}
      />

      <BottomSheet
        open={!!deleteRecord}
        onClose={() => !deleting && setDeleteRecord(null)}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeleteRecord(null)}
              disabled={deleting}
              className="kbs-press flex-1 rounded-2xl bg-line/[0.06] py-4 text-[14px] font-medium text-fog/75"
            >
              வேண்டாம்
            </button>
            <button
              type="button"
              data-testid="confirm-delete-button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="kbs-press flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral-500 py-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {deleting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  நீக்கு
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center pb-2 pt-4 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-coral-500/10 ring-1 ring-coral-500/25">
            <Trash2 className="h-7 w-7 text-coral-400" />
          </div>
          <h2 className="mt-5 text-[19px] font-semibold tracking-tight">பதிவை நீக்கவா?</h2>
          {deleteRecord && (
            <p className="mt-1.5 text-[14px] text-fog/55">
              {deleteRecord.name} · {formatCurrency(deleteRecord.total_amount)}
            </p>
          )}
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-fog/40">இந்தப் பதிவு நிரந்தரமாக நீக்கப்படும். இதைத் திரும்பப் பெற முடியாது.</p>
        </div>
      </BottomSheet>
    </>
  );
}
