'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '@/components/NavBar';
import DesktopSidebar from '@/components/DesktopSidebar';
import DesktopTopBar from '@/components/DesktopTopBar';
import { useMeridianLanguage } from '@/lib/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

type InjectionSite = 'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right';
type AppLanguage = 'es' | 'en';
type ActiveModal = 'medication' | 'supplement' | 'peptide' | null;

type TirzepatideEntry = {
  id: string;
  user_id: string;
  date: string;
  dose: number;
  site: InjectionSite;
  notes: string | null;
  created_at: string;
};

type MedicationEntry = {
  id: string;
  user_id: string;
  medication_name: string;
  category: string;
  date: string;
  dose: number;
  dose_unit: string;
  route: string;
  site: string | null;
  notes: string | null;
  created_at: string;
};

type Supplement = {
  id: string;
  user_id: string;
  supplement_name: string;
  brand: string | null;
  dose: number | null;
  dose_unit: string;
  frequency: string;
  timing: string | null;
  active: boolean;
  notes: string | null;
  sort_order: number;
};

type PeptideEntry = {
  id: string;
  user_id: string;
  peptide_name: string;
  date: string;
  dose: number;
  dose_unit: string;
  route: string;
  cycle_active: boolean;
  cycle_start: string | null;
  cycle_end: string | null;
  notes: string | null;
};

type ProfileFlags = {
  medications_enabled: boolean;
  peptides_enabled: boolean;
  glp1_protocol_enabled: boolean;
};

// ── Design tokens ──────────────────────────────────────────────────────────────

const C = {
  bg: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  cardBorderHover: 'rgba(103,232,249,0.25)',
};

const F = {
  heading: '"Fraunces", Georgia, serif',
  ui: '"Plus Jakarta Sans", sans-serif',
};

// ── Breakpoint ─────────────────────────────────────────────────────────────────

function useIsDesktop() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setV(mq.matches);
    const h = (e: MediaQueryListEvent) => setV(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return v;
}

// ── Site helpers (kept from original) ─────────────────────────────────────────

const SITE_OPTIONS = [
  { value: 'abdomen_left',  label: { es: 'Abdomen izquierdo', en: 'Left abdomen'  }, short: { es: 'Abd. izq.', en: 'Left abd.'   } },
  { value: 'thigh_right',   label: { es: 'Muslo derecho',     en: 'Right thigh'   }, short: { es: 'Muslo der.', en: 'Right thigh' } },
  { value: 'abdomen_right', label: { es: 'Abdomen derecho',   en: 'Right abdomen' }, short: { es: 'Abd. der.', en: 'Right abd.'  } },
  { value: 'thigh_left',    label: { es: 'Muslo izquierdo',   en: 'Left thigh'    }, short: { es: 'Muslo izq.', en: 'Left thigh' } },
];

const SITE_ROTATION: Record<InjectionSite, InjectionSite> = {
  abdomen_left: 'thigh_right', thigh_right: 'abdomen_right',
  abdomen_right: 'thigh_left', thigh_left: 'abdomen_left',
};

const DOSE_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15];

function getSiteLabel(site: string, lang: AppLanguage) {
  return SITE_OPTIONS.find(o => o.value === site)?.label[lang] ?? '—';
}
function getSiteShort(site: string, lang: AppLanguage) {
  return SITE_OPTIONS.find(o => o.value === site)?.short[lang] ?? '—';
}
function getSuggestedSite(entries: TirzepatideEntry[]): InjectionSite {
  const last = entries[0]?.site;
  return last && SITE_ROTATION[last] ? SITE_ROTATION[last] : 'abdomen_left';
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function parseLocal(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function fmtInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(d: string, lang: AppLanguage) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-PR', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseLocal(d));
}
function addDays(d: string, n: number) {
  const dt = parseLocal(d); dt.setDate(dt.getDate() + n); return fmtInput(dt);
}
function daysSince(d: string) {
  const today = new Date(); const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((t.getTime() - parseLocal(d).getTime()) / 86_400_000));
}
function sortEntries<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => parseLocal(b.date).getTime() - parseLocal(a.date).getTime());
}

// ── Frequency / timing display ────────────────────────────────────────────────

function fmtFrequency(f: string, lang: AppLanguage): string {
  const map: Record<string, Record<AppLanguage, string>> = {
    daily:            { es: 'Diario',          en: 'Daily' },
    '2x_week':        { es: '2× / semana',     en: '2× / week' },
    '3x_week':        { es: '3× / semana',     en: '3× / week' },
    '5x_week':        { es: '5× / semana',     en: '5× / week' },
    as_needed:        { es: 'Según necesidad', en: 'As needed' },
    high_stress_only: { es: 'Días de estrés',  en: 'High-stress days' },
    cycling:          { es: 'Ciclado',         en: 'Cycling' },
    other:            { es: 'Otro',            en: 'Other' },
  };
  return map[f]?.[lang] ?? f;
}

function fmtTiming(t: string | null, lang: AppLanguage): string {
  if (!t) return '';
  const map: Record<string, Record<AppLanguage, string>> = {
    morning:          { es: 'Mañana',           en: 'Morning' },
    midday:           { es: 'Mediodía',         en: 'Midday' },
    evening:          { es: 'Tarde',            en: 'Evening' },
    before_bed:       { es: 'Antes de dormir',  en: 'Before bed' },
    with_food:        { es: 'Con comida',       en: 'With food' },
    before_training:  { es: 'Antes de entrenar',en: 'Before training' },
    after_training:   { es: 'Después de entrenar',en: 'After training' },
    other:            { es: 'Otro',             en: 'Other' },
  };
  return map[t]?.[lang] ?? t;
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function SectionHeader({ label, onAdd, addLabel }: { label: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.teal, boxShadow: `0 0 6px ${C.teal}80` }} />
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted }}>{label}</span>
      </div>
      {onAdd && (
        <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', border: `0.5px solid ${C.cardBorder}`, background: 'transparent', color: C.textMuted, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: F.ui }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> {addLabel}
        </button>
      )}
    </div>
  );
}

function EmptyCard({ text, cta, onCta }: { text: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={{ padding: '20px 24px', border: `0.5px dashed rgba(103,232,249,0.2)`, borderRadius: '14px', background: 'rgba(6,19,22,0.3)', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: C.textMuted, margin: cta ? '0 0 12px' : '0', lineHeight: 1.6 }}>{text}</p>
      {cta && onCta && (
        <button onClick={onCta} style={{ padding: '7px 16px', borderRadius: '20px', border: `0.5px solid rgba(45,212,191,0.3)`, background: 'rgba(45,212,191,0.07)', color: C.teal, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: F.ui }}>
          {cta}
        </button>
      )}
    </div>
  );
}

// ── Modal base ─────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(6,19,22,0.75)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 201, width: 'min(520px, 92vw)', maxHeight: '85vh', overflowY: 'auto', backgroundColor: '#081A1E', border: `1px solid ${C.cardBorder}`, borderRadius: '20px', fontFamily: F.ui, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `0.5px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: F.heading, fontSize: '20px', fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '50%', border: `0.5px solid ${C.cardBorder}`, background: 'transparent', color: C.textMuted, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.ui }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </>
  );
}

// ── Form field atom ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: C.textSoft, letterSpacing: '0.02em' }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.cardBorder}`, background: 'rgba(6,19,22,0.62)',
  color: C.text, borderRadius: '12px', padding: '11px 13px',
  outline: 'none', fontSize: '13px', fontFamily: F.ui,
};

// ── Main page component ────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ), []);

  const [lang] = useMeridianLanguage();
  const isDesktop = useIsDesktop();

  // ── Profile flags ──────────────────────────────────────────────────────────
  const [flags, setFlags] = useState<ProfileFlags>({ medications_enabled: false, peptides_enabled: false, glp1_protocol_enabled: false });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Medications (tirzepatide via existing API) ─────────────────────────────
  const [entries, setEntries] = useState<TirzepatideEntry[]>([]);
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [savingMed, setSavingMed] = useState(false);
  const [medError, setMedError] = useState('');
  const [medSuccess, setMedSuccess] = useState('');
  const [date, setDate] = useState(() => fmtInput(new Date()));
  const [dose, setDose] = useState<number>(2.5);
  const [site, setSite] = useState<InjectionSite>('abdomen_left');
  const [medNotes, setMedNotes] = useState('');
  const [showMedForm, setShowMedForm] = useState(false);

  // ── Supplements ────────────────────────────────────────────────────────────
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loadingSupps, setLoadingSupps] = useState(false);

  // ── Peptides ───────────────────────────────────────────────────────────────
  const [peptides, setPeptides] = useState<PeptideEntry[]>([]);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [showGlp1History, setShowGlp1History] = useState(false);
  const [selectedGlp1Note, setSelectedGlp1Note] = useState<string | null>(null);

  // ── New supplement form state ──────────────────────────────────────────────
  const [newSupp, setNewSupp] = useState({ name: '', brand: '', dose: '', dose_unit: 'mg', frequency: 'daily', timing: 'morning', notes: '' });
  const [savingSupp, setSavingSupp] = useState(false);

  // ── New peptide form state ─────────────────────────────────────────────────
  const [newPep, setNewPep] = useState({ name: '', dose: '', dose_unit: 'mcg', route: 'subcutaneous', cycle_start: fmtInput(new Date()), cycle_end: '', notes: '' });
  const [savingPep, setSavingPep] = useState(false);

  // ── New medication form state (non-GLP1) ───────────────────────────────────
  const [newMed, setNewMed] = useState({ name: '', category: 'other', dose: '', dose_unit: 'mg', route: 'oral', notes: '' });
  const [savingNewMed, setSavingNewMed] = useState(false);

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/onboarding/welcome'); return; }
      if (!mounted) return;
      setUserId(user.id);

      // Profile flags
      const { data: profile } = await supabase
        .from('profiles')
        .select('medications_enabled, peptides_enabled, glp1_protocol_enabled')
        .eq('id', user.id).single();
      if (!mounted) return;
      if (profile) setFlags({
        medications_enabled: Boolean(profile.medications_enabled),
        peptides_enabled: Boolean(profile.peptides_enabled),
        glp1_protocol_enabled: Boolean(profile.glp1_protocol_enabled),
      });

      // GLP-1 entries (via existing API)
      if (profile?.glp1_protocol_enabled || profile?.medications_enabled) {
        const res = await fetch('/api/tirzepatide', { method: 'GET', cache: 'no-store' });
        if (mounted && res.ok) {
          const payload = await res.json();
          if (payload.success && payload.protocol_enabled) {
            setEntries(sortEntries(payload.data ?? []));
          }
        }
      }

      // Generic medication entries (non-GLP-1). This is intentionally soft-fail
      // because some environments may not have the medication_entries migration yet.
      if (profile?.medications_enabled) {
        const { data: meds } = await supabase
          .from('medication_entries')
          .select('*')
          .eq('user_id', user.id)
          .neq('category', 'glp1')
          .order('date', { ascending: false });
        if (mounted) setMedications((meds ?? []) as MedicationEntry[]);
      }

      // Supplements
      setLoadingSupps(true);
      const { data: supps } = await supabase
        .from('supplement_stack')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      if (mounted) { setSupplements(supps ?? []); setLoadingSupps(false); }

      // Peptides (if enabled)
      if (profile?.peptides_enabled) {
        const { data: peps } = await supabase
          .from('peptide_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        if (mounted) setPeptides(peps ?? []);
      }

      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [router, supabase]);

  // ── Tirzepatide derived values ─────────────────────────────────────────────
  const latestEntry = entries[0] ?? null;
  const suggestedSite = getSuggestedSite(entries);
  const nextDate = latestEntry ? addDays(latestEntry.date, 7) : null;
  const daysSinceLast = latestEntry ? daysSince(latestEntry.date) : null;

  // ── Save tirzepatide entry ─────────────────────────────────────────────────
  async function handleMedSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !flags.glp1_protocol_enabled) return;
    setSavingMed(true); setMedError(''); setMedSuccess('');
    const res = await fetch('/api/tirzepatide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, dose, site, notes: medNotes.trim() || null }) });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) { setMedError(res.status === 409 ? (lang === 'es' ? 'Ya existe una entrada para esa fecha.' : 'Entry already exists for that date.') : (lang === 'es' ? 'No se pudo guardar.' : 'Could not save.')); setSavingMed(false); return; }
    const updated = sortEntries([payload.data, ...entries]);
    setEntries(updated); setDate(fmtInput(new Date())); setMedNotes(''); setSite(getSuggestedSite(updated));
    setMedSuccess(lang === 'es' ? 'Entrada guardada.' : 'Entry saved.'); setSavingMed(false); setShowMedForm(false);
  }

  // ── Save generic medication ───────────────────────────────────────────────
  async function handleSaveNewMedication() {
    if (!userId || !newMed.name.trim() || !newMed.dose) return;
    setSavingNewMed(true);
    setMedError('');
    setMedSuccess('');

    const { data, error } = await supabase.from('medication_entries').insert({
      user_id: userId,
      medication_name: newMed.name.trim(),
      category: newMed.category,
      date: fmtInput(new Date()),
      dose: Number(newMed.dose),
      dose_unit: newMed.dose_unit,
      route: newMed.route,
      site: null,
      notes: newMed.notes.trim() || null,
    }).select().single();

    if (error || !data) {
      setMedError(lang === 'es' ? 'No se pudo guardar el medicamento.' : 'Could not save medication.');
      setSavingNewMed(false);
      return;
    }

    setMedications(prev => [data as MedicationEntry, ...prev]);
    setNewMed({ name: '', category: 'other', dose: '', dose_unit: 'mg', route: 'oral', notes: '' });
    setActiveModal(null);
    setMedSuccess(lang === 'es' ? 'Medicamento guardado.' : 'Medication saved.');
    setSavingNewMed(false);
  }

  // ── Save supplement ────────────────────────────────────────────────────────
  async function handleSaveSupp() {
    if (!userId || !newSupp.name.trim()) return;
    setSavingSupp(true);
    const { data, error } = await supabase.from('supplement_stack').insert({
      user_id: userId,
      supplement_name: newSupp.name.trim(),
      brand: newSupp.brand.trim() || null,
      dose: newSupp.dose ? Number(newSupp.dose) : null,
      dose_unit: newSupp.dose_unit,
      frequency: newSupp.frequency,
      timing: newSupp.timing || null,
      notes: newSupp.notes.trim() || null,
      active: true,
      sort_order: supplements.length,
    }).select().single();
    if (!error && data) { setSupplements(prev => [...prev, data as Supplement]); setNewSupp({ name: '', brand: '', dose: '', dose_unit: 'mg', frequency: 'daily', timing: 'morning', notes: '' }); setActiveModal(null); }
    setSavingSupp(false);
  }

  // ── Save peptide ───────────────────────────────────────────────────────────
  async function handleSavePep() {
    if (!userId || !newPep.name.trim() || !newPep.dose) return;
    setSavingPep(true);
    const { data, error } = await supabase.from('peptide_entries').insert({
      user_id: userId,
      peptide_name: newPep.name.trim(),
      date: newPep.cycle_start,
      dose: Number(newPep.dose),
      dose_unit: newPep.dose_unit,
      route: newPep.route,
      cycle_active: true,
      cycle_start: newPep.cycle_start || null,
      cycle_end: newPep.cycle_end || null,
      notes: newPep.notes.trim() || null,
    }).select().single();
    if (!error && data) { setPeptides(prev => [data as PeptideEntry, ...prev]); setNewPep({ name: '', dose: '', dose_unit: 'mcg', route: 'subcutaneous', cycle_start: fmtInput(new Date()), cycle_end: '', notes: '' }); setActiveModal(null); }
    setSavingPep(false);
  }

  // ── Toggle supplement active ───────────────────────────────────────────────
  async function toggleSupp(id: string, active: boolean) {
    await supabase.from('supplement_stack').update({ active: !active }).eq('id', id);
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, active: !active } : s));
  }

  // ── Delete supplement ──────────────────────────────────────────────────────
  async function deleteSupp(id: string) {
    await supabase.from('supplement_stack').delete().eq('id', id);
    setSupplements(prev => prev.filter(s => s.id !== id));
  }

  // ── Whether supplements section should show ────────────────────────────────
  const hasSupplements = supplements.length > 0;

  // ── Section visibility ─────────────────────────────────────────────────────
  // Medications: show if glp1_protocol_enabled OR medications_enabled
  const showMedications = flags.glp1_protocol_enabled || flags.medications_enabled;
  const showPeptides = flags.peptides_enabled;
  const nothingActive = !showMedications && !hasSupplements && !showPeptides && !loading;

  // ── Shared content blocks ──────────────────────────────────────────────────

  const PageHeader = () => (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.teal, boxShadow: `0 0 6px ${C.teal}90` }} />
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted }}>
          {lang === 'es' ? 'Plan de salud' : 'Health Plan'}
        </span>
      </div>
      <h1 style={{ fontFamily: F.heading, fontSize: '28px', fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {lang === 'es' ? 'Plan' : 'Plan'}
      </h1>
      <p style={{ fontSize: '13px', color: C.textMuted, margin: 0 }}>
        {lang === 'es' ? 'Tu protocolo de salud activo.' : 'Your active health protocol.'}
      </p>
    </div>
  );

  const PlanGuidanceCard = () => (
    <div
      style={{
        marginBottom: '28px',
        padding: isDesktop ? '20px 22px' : '18px',
        borderRadius: '20px',
        border: `1px solid ${C.cardBorder}`,
        background: 'linear-gradient(135deg, rgba(45,212,191,0.10) 0%, rgba(6,19,22,0.72) 42%, rgba(103,232,249,0.06) 100%)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '-70px',
          width: '180px',
          height: '180px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(45,212,191,0.16) 0%, transparent 68%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isDesktop ? '1.2fr 0.8fr' : '1fr', gap: '18px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: C.teal, boxShadow: `0 0 12px ${C.teal}` }} />
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.teal }}>
              {lang === 'es' ? 'Guía Meridian' : 'Meridian guidance'}
            </span>
          </div>
          <h2 style={{ fontFamily: F.heading, fontSize: isDesktop ? '22px' : '20px', lineHeight: 1.15, letterSpacing: '-0.03em', color: C.text, margin: '0 0 8px' }}>
            {lang === 'es' ? 'Lo que le das a tu cuerpo, organizado con intención.' : 'What you give your body, organized with intention.'}
          </h2>
          <p style={{ fontSize: '13px', lineHeight: 1.65, color: C.textSoft, margin: 0, maxWidth: '680px' }}>
            {lang === 'es'
              ? 'Plan reúne tus suplementos, medicamentos y protocolos activos para que puedas verlos como parte de una rutina completa, no como notas sueltas. A medida que tu contexto cambie, este espacio te ayuda a ajustar con calma y mantener claridad.'
              : 'Plan brings together your supplements, medications, and active protocols so you can see them as part of a complete routine, not scattered notes. As your context changes, this space helps you adjust calmly and keep clarity.'}
          </p>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            lang === 'es' ? 'Stack organizado por momento del día' : 'Stack organized by time of day',
            lang === 'es' ? 'Medicamentos y protocolos en un solo lugar' : 'Medications and protocols in one place',
            lang === 'es' ? 'Historial útil para detectar patrones' : 'History that helps reveal patterns',
          ].map(item => (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 11px',
                borderRadius: '12px',
                border: `0.5px solid ${C.cardBorder}`,
                background: 'rgba(6,19,22,0.34)',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: C.cyan, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: C.textSoft, fontWeight: 650 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const supplementGroups = [
    {
      key: 'morning',
      label: lang === 'es' ? 'Mañana' : 'Morning',
      hint: lang === 'es' ? 'Para iniciar el día con estructura.' : 'For starting the day with structure.',
      items: supplements.filter(s => s.timing === 'morning'),
    },
    {
      key: 'with_food',
      label: lang === 'es' ? 'Con comida' : 'With food',
      hint: lang === 'es' ? 'Mejor organizado alrededor de comidas.' : 'Best organized around meals.',
      items: supplements.filter(s => s.timing === 'with_food'),
    },
    {
      key: 'midday_evening',
      label: lang === 'es' ? 'Tarde / Noche' : 'Afternoon / Evening',
      hint: lang === 'es' ? 'Soporte para la segunda mitad del día.' : 'Support for the second half of the day.',
      items: supplements.filter(s => s.timing === 'midday' || s.timing === 'evening'),
    },
    {
      key: 'bedtime',
      label: lang === 'es' ? 'Antes de dormir' : 'Before bed',
      hint: lang === 'es' ? 'Parte de tu ritual de recuperación.' : 'Part of your recovery rhythm.',
      items: supplements.filter(s => s.timing === 'before_bed'),
    },
    {
      key: 'training',
      label: lang === 'es' ? 'Entrenamiento' : 'Training',
      hint: lang === 'es' ? 'Alrededor de tus sesiones de movimiento.' : 'Around your movement sessions.',
      items: supplements.filter(s => s.timing === 'before_training' || s.timing === 'after_training'),
    },
    {
      key: 'as_needed',
      label: lang === 'es' ? 'Según necesidad' : 'As needed',
      hint: lang === 'es' ? 'No tienen que ser diarios por diseño.' : 'Not necessarily daily by design.',
      items: supplements.filter(s => {
        const knownTiming = ['morning', 'with_food', 'midday', 'evening', 'before_bed', 'before_training', 'after_training'].includes(s.timing || '');
        return !knownTiming && (s.frequency === 'as_needed' || s.frequency === 'high_stress_only' || s.frequency === 'cycling');
      }),
    },
    {
      key: 'other',
      label: lang === 'es' ? 'Otros' : 'Other',
      hint: lang === 'es' ? 'Suplementos activos sin momento definido.' : 'Active supplements without a defined timing.',
      items: supplements.filter(s => {
        const knownTiming = ['morning', 'with_food', 'midday', 'evening', 'before_bed', 'before_training', 'after_training'].includes(s.timing || '');
        const knownFrequency = ['as_needed', 'high_stress_only', 'cycling'].includes(s.frequency);
        return !knownTiming && !knownFrequency;
      }),
    },
  ].filter(group => group.items.length > 0);

  // ── Supplements section ────────────────────────────────────────────────────

  const supplementsSection = (
    <div style={{ marginBottom: '32px' }}>
      <SectionHeader
        label={lang === 'es' ? 'Suplementos' : 'Supplements'}
        onAdd={() => setActiveModal('supplement')}
        addLabel={lang === 'es' ? 'Añadir' : 'Add'}
      />
      {loadingSupps ? (
        <div style={{ padding: '16px', color: C.textMuted, fontSize: '13px' }}>{lang === 'es' ? 'Cargando...' : 'Loading...'}</div>
      ) : !hasSupplements ? (
        <EmptyCard
          text={lang === 'es' ? 'Añade tus suplementos activos — vitaminas, minerales, adaptogens.' : 'Add your active supplements — vitamins, minerals, adaptogens.'}
          cta={lang === 'es' ? 'Añadir suplemento' : 'Add supplement'}
          onCta={() => setActiveModal('supplement')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {supplementGroups.map(group => (
            <div key={group.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 3px' }}>
                    {group.label}
                  </p>
                  <p style={{ fontSize: '11px', color: C.textSoft, margin: 0 }}>
                    {group.hint}
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: C.textMuted }}>
                  {group.items.length}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '10px' }}>
                {group.items.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '14px 15px',
                      background: s.active
                        ? 'linear-gradient(135deg, rgba(232,248,245,0.045) 0%, rgba(6,19,22,0.58) 100%)'
                        : 'rgba(6,19,22,0.28)',
                      border: `1px solid ${s.active ? C.cardBorder : 'rgba(103,232,249,0.06)'}`,
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: s.active ? 1 : 0.55,
                      boxShadow: s.active ? '0 14px 34px rgba(0,0,0,0.14)' : 'none',
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: s.active ? C.teal : C.textMuted, boxShadow: s.active ? `0 0 10px ${C.teal}80` : 'none', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 750, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.supplement_name}
                        </span>
                        {s.brand && (
                          <span style={{ fontSize: '11px', color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.brand}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.dose && <span style={{ fontSize: '11px', color: C.textSoft }}>{s.dose} {s.dose_unit}</span>}
                        <span style={{ fontSize: '11px', color: C.textMuted }}>·</span>
                        <span style={{ fontSize: '11px', color: C.textMuted }}>{fmtFrequency(s.frequency, lang)}</span>
                        {s.timing && (
                          <>
                            <span style={{ fontSize: '11px', color: C.textMuted }}>·</span>
                            <span style={{ fontSize: '11px', color: C.textMuted }}>{fmtTiming(s.timing, lang)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => toggleSupp(s.id, s.active)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '999px',
                          border: `0.5px solid ${s.active ? 'rgba(45,212,191,0.35)' : C.cardBorder}`,
                          background: s.active ? 'rgba(45,212,191,0.08)' : 'transparent',
                          color: s.active ? C.teal : C.textMuted,
                          fontSize: '10px',
                          fontWeight: 800,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: F.ui,
                        }}
                      >
                        {s.active ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Pausado' : 'Paused')}
                      </button>
                      <button
                        onClick={() => {
                          const ok = window.confirm(lang === 'es' ? '¿Eliminar este suplemento?' : 'Delete this supplement?');
                          if (ok) deleteSupp(s.id);
                        }}
                        title={lang === 'es' ? 'Más opciones' : 'More options'}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '999px',
                          border: `0.5px solid ${C.cardBorder}`,
                          background: 'rgba(6,19,22,0.25)',
                          color: C.textMuted,
                          fontSize: '14px',
                          cursor: 'pointer',
                          fontFamily: F.ui,
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Medications section ────────────────────────────────────────────────────

  const medicationsSection = (
    <div style={{ marginBottom: '32px' }}>
      <SectionHeader
        label={lang === 'es' ? 'Medicamentos activos' : 'Active medications'}
        onAdd={() => setShowMedForm(f => !f)}
        addLabel={lang === 'es' ? 'Registrar dosis' : 'Log dose'}
      />
      <p style={{ fontSize: '12px', color: C.textMuted, margin: '-8px 0 14px', lineHeight: 1.5 }}>
        {lang === 'es' ? 'Registra medicamentos, dosis, frecuencia y notas relevantes.' : 'Record medications, doses, frequency, and relevant notes.'}
      </p>

      {flags.glp1_protocol_enabled && (
        <>
          {/* Tirzepatide card */}
          <div style={{ padding: '16px 18px', backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Tirzepatide</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(45,212,191,0.08)', border: '0.5px solid rgba(45,212,191,0.2)', color: C.teal }}>GLP-1</span>
                </div>
                <span style={{ fontSize: '12px', color: C.textMuted }}>
                  {lang === 'es' ? 'Subcutáneo · semanal' : 'Subcutaneous · weekly'}
                </span>
              </div>
              <button onClick={() => setShowMedForm(f => !f)}
                style={{ padding: '6px 14px', borderRadius: '20px', border: `0.5px solid ${showMedForm ? 'rgba(45,212,191,0.35)' : C.cardBorder}`, background: showMedForm ? 'rgba(45,212,191,0.08)' : 'transparent', color: showMedForm ? C.teal : C.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: F.ui, whiteSpace: 'nowrap' }}>
                {lang === 'es' ? 'Registrar dosis' : 'Log dose'}
              </button>
            </div>

            {/* Status tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: showMedForm ? '16px' : '0' }}>
              {[
                { label: lang === 'es' ? 'Dosis actual' : 'Current dose', value: latestEntry ? `${Number(latestEntry.dose)} mg` : (lang === 'es' ? 'Sin registro' : 'Not logged'), hint: latestEntry ? fmtDate(latestEntry.date, lang) : (lang === 'es' ? 'Registra tu primera dosis' : 'Log your first dose') },
                { label: lang === 'es' ? 'Días desde última' : 'Days since last', value: daysSinceLast !== null ? String(daysSinceLast) : (lang === 'es' ? 'Sin registro' : 'Not logged'), hint: lang === 'es' ? 'Desde tu último registro' : 'From your last entry' },
                { label: lang === 'es' ? 'Próxima fecha' : 'Next date', value: nextDate ? fmtDate(nextDate, lang) : (lang === 'es' ? 'Pendiente' : 'Pending'), hint: lang === 'es' ? 'Cadencia semanal estimada' : 'Estimated weekly cadence' },
                { label: lang === 'es' ? 'Sitio sugerido' : 'Suggested site', value: getSiteShort(suggestedSite, lang), hint: getSiteLabel(suggestedSite, lang) },
              ].map(tile => (
                <div key={tile.label} style={{ padding: '12px', background: 'rgba(6,19,22,0.4)', border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 6px' }}>{tile.label}</p>
                  <p style={{ fontFamily: F.heading, fontSize: '18px', fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1 }}>{tile.value}</p>
                  <p style={{ fontSize: '11px', color: C.textSoft, margin: 0 }}>{tile.hint}</p>
                </div>
              ))}
            </div>

            {/* Inline log form */}
            <AnimatePresence>
              {showMedForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ paddingTop: '4px', borderTop: `0.5px solid ${C.cardBorder}` }}>
                    <form onSubmit={handleMedSubmit}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '14px 0 12px' }}>
                        <Field label={lang === 'es' ? 'Fecha' : 'Date'}>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => {
                                try { dateInputRef.current?.showPicker?.(); } catch {}
                              }}
                              style={{
                                width: '100%',
                                minHeight: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                border: `1px solid ${C.cardBorder}`,
                                background: 'rgba(6,19,22,0.62)',
                                color: C.text,
                                borderRadius: '12px',
                                padding: '11px 13px',
                                fontSize: '13px',
                                fontFamily: F.ui,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <span>{date ? fmtDate(date, lang) : (lang === 'es' ? 'Seleccionar fecha' : 'Select date')}</span>
                              <span style={{ color: C.teal, fontSize: '14px' }}>◷</span>
                            </button>
                            <input
                              ref={dateInputRef}
                              type="date"
                              value={date}
                              onChange={e => setDate(e.target.value)}
                              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none', bottom: 0, left: 0 }}
                              required
                            />
                          </div>
                        </Field>
                        <Field label={lang === 'es' ? 'Dosis' : 'Dose'}>
                          <select value={dose} onChange={e => setDose(Number(e.target.value))} style={inputStyle}>
                            {DOSE_OPTIONS.map(d => <option key={d} value={d}>{d} mg</option>)}
                          </select>
                        </Field>
                        <Field label={lang === 'es' ? 'Sitio' : 'Site'}>
                          <select value={site} onChange={e => setSite(e.target.value as InjectionSite)} style={inputStyle}>
                            {SITE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
                          </select>
                        </Field>
                      </div>
                      <Field label={lang === 'es' ? 'Notas' : 'Notes'}>
                        <textarea value={medNotes} onChange={e => setMedNotes(e.target.value)} placeholder={lang === 'es' ? 'Síntomas, tolerancia, contexto...' : 'Symptoms, tolerance, context...'} style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }} />
                      </Field>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button type="submit" disabled={savingMed} style={{ flex: 1, padding: '11px 16px', background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`, border: 'none', borderRadius: '10px', color: '#041112', fontFamily: F.ui, fontSize: '13px', fontWeight: 700, cursor: savingMed ? 'not-allowed' : 'pointer', opacity: savingMed ? 0.6 : 1 }}>
                          {savingMed ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar entrada' : 'Save entry')}
                        </button>
                        <button type="button" onClick={() => setShowMedForm(false)} style={{ padding: '11px 16px', background: 'transparent', border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px', color: C.textMuted, fontFamily: F.ui, fontSize: '13px', cursor: 'pointer' }}>
                          {lang === 'es' ? 'Cancelar' : 'Cancel'}
                        </button>
                      </div>
                      {medError && <p style={{ fontSize: '12px', color: '#F87171', margin: '8px 0 0' }}>{medError}</p>}
                      {medSuccess && <p style={{ fontSize: '12px', color: C.teal, margin: '8px 0 0' }}>{medSuccess}</p>}
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent entries */}
          {entries.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 8px' }}>
                {lang === 'es' ? 'Historial reciente' : 'Recent history'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.slice(0, 3).map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(6,19,22,0.35)', border: `0.5px solid ${C.cardBorder}`, borderRadius: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, flex: 1 }}>{fmtDate(e.date, lang)}</span>
                    <span style={{ fontSize: '12px', color: C.textMuted }}>{getSiteShort(e.site, lang)}</span>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', border: '0.5px solid rgba(103,232,249,0.22)', background: 'rgba(103,232,249,0.07)', fontSize: '12px', fontWeight: 700, color: C.cyan }}>{Number(e.dose)} mg</span>
                    <button
                      type="button"
                      onClick={() => e.notes && setSelectedGlp1Note(e.notes)}
                      title={e.notes ? (lang === 'es' ? 'Ver nota' : 'View note') : (lang === 'es' ? 'Sin nota' : 'No note')}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        border: `0.5px solid ${e.notes ? 'rgba(45,212,191,0.35)' : C.cardBorder}`,
                        background: e.notes ? 'rgba(45,212,191,0.08)' : 'rgba(6,19,22,0.25)',
                        color: e.notes ? C.teal : C.textMuted,
                        cursor: e.notes ? 'pointer' : 'default',
                        fontSize: '13px',
                        fontFamily: F.ui,
                      }}
                    >
                      ✎
                    </button>
                  </div>
                ))}
                {entries.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowGlp1History(true)}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: '4px',
                      padding: '8px 0',
                      background: 'transparent',
                      border: 'none',
                      color: C.teal,
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: F.ui,
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'es' ? 'Ver historial completo →' : 'View full history →'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!flags.glp1_protocol_enabled && flags.medications_enabled && (
        medications.length === 0 ? (
          <EmptyCard
            text={lang === 'es' ? 'Registra tus medicamentos activos — Rx, hormonas, y otros tratamientos.' : 'Record your active medications — Rx, hormones, and other treatments.'}
            cta={lang === 'es' ? 'Añadir medicamento' : 'Add medication'}
            onCta={() => setActiveModal('medication')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setActiveModal('medication')} style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '999px', border: `0.5px solid ${C.cardBorder}`, background: 'rgba(103,232,249,0.07)', color: C.cyan, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              + {lang === 'es' ? 'Añadir medicamento' : 'Add medication'}
            </button>
            {medications.map(m => (
              <div key={m.id} style={{ padding: '12px', borderRadius: '12px', border: `0.5px solid ${C.cardBorder}`, background: 'rgba(6,19,22,0.34)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.text, flex: 1 }}>{m.medication_name}</span>
                <span style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.category}</span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', border: '0.5px solid rgba(103,232,249,0.22)', background: 'rgba(103,232,249,0.07)', fontSize: '12px', fontWeight: 700, color: C.cyan }}>{Number(m.dose)} {m.dose_unit}</span>
                <span style={{ fontSize: '12px', color: C.textMuted }}>{m.route}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );

  // ── Training Program section ────────────────────────────────────────────────

  const trainingProgramSection = (
    <div style={{ marginBottom: '32px' }}>
      <SectionHeader
        label={lang === 'es' ? 'Programa de entrenamiento' : 'Training program'}
        onAdd={() => {}}
        addLabel={lang === 'es' ? 'Crear' : 'Create'}
      />

      <div
        style={{
          padding: isDesktop ? '22px' : '18px',
          borderRadius: '20px',
          border: `1px solid ${C.cardBorder}`,
          background: 'linear-gradient(135deg, rgba(232,248,245,0.045) 0%, rgba(6,19,22,0.62) 100%)',
          boxShadow: '0 18px 42px rgba(0,0,0,0.14)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-70px',
            width: '180px',
            height: '180px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(103,232,249,0.12) 0%, transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isDesktop ? '1.1fr 0.9fr' : '1fr', gap: '18px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` }} />
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.cyan }}>
                {lang === 'es' ? 'Builder personalizado' : 'Custom builder'}
              </span>
            </div>

            <h2 style={{ fontFamily: F.heading, fontSize: isDesktop ? '22px' : '20px', lineHeight: 1.15, letterSpacing: '-0.03em', color: C.text, margin: '0 0 8px' }}>
              {lang === 'es' ? 'Crea tu programa a tu manera.' : 'Build your program your way.'}
            </h2>

            <p style={{ fontSize: '13px', color: C.textSoft, margin: 0, lineHeight: 1.6, maxWidth: '620px' }}>
              {lang === 'es'
                ? 'Organiza días de entrenamiento, ejercicios, series, repeticiones, cargas objetivo y notas. Meridian puede usar plantillas como punto de partida, pero el usuario decide qué añadir.'
                : 'Organize training days, exercises, sets, reps, target loads, and notes. Meridian can offer templates as a starting point, but the user decides what to add.'}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              lang === 'es' ? 'Crear desde cero' : 'Create from scratch',
              lang === 'es' ? 'Usar plantilla opcional' : 'Use optional template',
              lang === 'es' ? 'Editar días y ejercicios luego' : 'Edit days and exercises later',
            ].map(item => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '9px 11px',
                  borderRadius: '12px',
                  border: `0.5px solid ${C.cardBorder}`,
                  background: 'rgba(6,19,22,0.34)',
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: C.teal, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: C.textSoft, fontWeight: 650 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {}}
            style={{
              padding: '10px 14px',
              borderRadius: '999px',
              border: 'none',
              background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`,
              color: '#041112',
              fontFamily: F.ui,
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {lang === 'es' ? 'Crear programa' : 'Create program'}
          </button>

          <button
            type="button"
            onClick={() => {}}
            style={{
              padding: '10px 14px',
              borderRadius: '999px',
              border: `0.5px solid ${C.cardBorder}`,
              background: 'rgba(6,19,22,0.28)',
              color: C.textSoft,
              fontFamily: F.ui,
              fontSize: '12px',
              fontWeight: 750,
              cursor: 'pointer',
            }}
          >
            {lang === 'es' ? 'Ver plantillas' : 'View templates'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Peptides section ───────────────────────────────────────────────────────

  const PeptidesSection = () => (
    <div style={{ marginBottom: '32px' }}>
      <SectionHeader
        label={lang === 'es' ? 'Péptidos' : 'Peptides'}
        onAdd={() => setActiveModal('peptide')}
        addLabel={lang === 'es' ? 'Registrar' : 'Log'}
      />
      {peptides.filter(p => p.cycle_active).length === 0 ? (
        <EmptyCard
          text={lang === 'es' ? 'No hay ciclos de péptidos activos.' : 'No active peptide cycles.'}
          cta={lang === 'es' ? 'Registrar péptido' : 'Log peptide'}
          onCta={() => setActiveModal('peptide')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {peptides.filter(p => p.cycle_active).map(p => (
            <div key={p.id} style={{ padding: '14px 16px', backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, display: 'block', marginBottom: '3px' }}>{p.peptide_name}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: C.textSoft }}>{p.dose} {p.dose_unit}</span>
                  <span style={{ fontSize: '11px', color: C.textMuted }}>·</span>
                  <span style={{ fontSize: '11px', color: C.textMuted }}>{p.route}</span>
                  {p.cycle_start && <><span style={{ fontSize: '11px', color: C.textMuted }}>·</span><span style={{ fontSize: '11px', color: C.textMuted }}>{lang === 'es' ? 'Inicio' : 'Start'}: {fmtDate(p.cycle_start, lang)}</span></>}
                  {p.cycle_end && <><span style={{ fontSize: '11px', color: C.textMuted }}>·</span><span style={{ fontSize: '11px', color: C.textMuted }}>{lang === 'es' ? 'Fin' : 'End'}: {fmtDate(p.cycle_end, lang)}</span></>}
                </div>
              </div>
              <span style={{ padding: '3px 9px', borderRadius: '20px', border: '0.5px solid rgba(103,232,249,0.2)', background: 'rgba(103,232,249,0.06)', fontSize: '10px', fontWeight: 700, color: C.cyan, flexShrink: 0 }}>
                {lang === 'es' ? 'Activo' : 'Active'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Nothing active empty state ─────────────────────────────────────────────

  const NothingActive = () => (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <h2 style={{ fontFamily: F.heading, fontSize: '22px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
        {lang === 'es' ? 'Tu plan está vacío' : 'Your plan is empty'}
      </h2>
      <p style={{ fontSize: '13px', color: C.textMuted, maxWidth: '320px', margin: '0 auto 24px', lineHeight: 1.6 }}>
        {lang === 'es' ? 'Añade suplementos desde aquí. Para activar Medicamentos o Péptidos, ve a tu perfil.' : 'Add supplements here. To enable Medications or Peptides, go to your profile.'}
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveModal('supplement')} style={{ padding: '10px 20px', background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`, border: 'none', borderRadius: '20px', color: '#041112', fontFamily: F.ui, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'es' ? 'Añadir suplemento' : 'Add supplement'}
        </button>
        <button onClick={() => router.push('/profile')} style={{ padding: '10px 20px', background: 'transparent', border: `0.5px solid ${C.cardBorder}`, borderRadius: '20px', color: C.textMuted, fontFamily: F.ui, fontSize: '13px', cursor: 'pointer' }}>
          {lang === 'es' ? 'Ir a Perfil' : 'Go to Profile'}
        </button>
      </div>
    </div>
  );

  // ── Modals ─────────────────────────────────────────────────────────────────

  const modals = (
    <AnimatePresence>
      {activeModal === 'medication' && (
        <Modal title={lang === 'es' ? 'Añadir medicamento' : 'Add medication'} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label={lang === 'es' ? 'Nombre *' : 'Name *'}>
              <input type="text" value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))} placeholder="Metformin, Levothyroxine..." style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Categoría' : 'Category'}>
                <select value={newMed.category} onChange={e => setNewMed(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {[['rx', 'Rx'], ['hormone', lang === 'es' ? 'Hormona' : 'Hormone'], ['thyroid', lang === 'es' ? 'Tiroides' : 'Thyroid'], ['other', lang === 'es' ? 'Otro' : 'Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label={lang === 'es' ? 'Vía' : 'Route'}>
                <select value={newMed.route} onChange={e => setNewMed(p => ({ ...p, route: e.target.value }))} style={inputStyle}>
                  {[['oral', 'Oral'], ['subcutaneous', lang === 'es' ? 'Subcutánea' : 'Subcutaneous'], ['intramuscular', lang === 'es' ? 'Intramuscular' : 'Intramuscular'], ['topical', lang === 'es' ? 'Tópica' : 'Topical'], ['other', lang === 'es' ? 'Otra' : 'Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Dosis *' : 'Dose *'}>
                <input type="number" value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))} placeholder="500" style={inputStyle} min="0" />
              </Field>
              <Field label={lang === 'es' ? 'Unidad' : 'Unit'}>
                <select value={newMed.dose_unit} onChange={e => setNewMed(p => ({ ...p, dose_unit: e.target.value }))} style={inputStyle}>
                  {['mg','mcg','g','IU','units','ml'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label={lang === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}>
              <textarea value={newMed.notes} onChange={e => setNewMed(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />
            </Field>
            {medError && <p style={{ color: '#FCA5A5', fontSize: '12px', margin: 0 }}>{medError}</p>}
            <button onClick={handleSaveNewMedication} disabled={savingNewMed || !newMed.name.trim() || !newMed.dose}
              style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`, border: 'none', borderRadius: '12px', color: '#041112', fontFamily: F.ui, fontSize: '14px', fontWeight: 700, cursor: (!newMed.name.trim() || !newMed.dose || savingNewMed) ? 'not-allowed' : 'pointer', opacity: (!newMed.name.trim() || !newMed.dose || savingNewMed) ? 0.6 : 1 }}>
              {savingNewMed ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar medicamento' : 'Save medication')}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'supplement' && (
        <Modal title={lang === 'es' ? 'Añadir suplemento' : 'Add supplement'} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label={lang === 'es' ? 'Nombre *' : 'Name *'}>
              <input type="text" value={newSupp.name} onChange={e => setNewSupp(p => ({ ...p, name: e.target.value }))} placeholder="Vitamina D3 + K2" style={inputStyle} />
            </Field>
            <Field label={lang === 'es' ? 'Marca (opcional)' : 'Brand (optional)'}>
              <input type="text" value={newSupp.brand} onChange={e => setNewSupp(p => ({ ...p, brand: e.target.value }))} placeholder="Sports Research" style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Dosis' : 'Dose'}>
                <input type="number" value={newSupp.dose} onChange={e => setNewSupp(p => ({ ...p, dose: e.target.value }))} placeholder="5000" style={inputStyle} min="0" />
              </Field>
              <Field label={lang === 'es' ? 'Unidad' : 'Unit'}>
                <select value={newSupp.dose_unit} onChange={e => setNewSupp(p => ({ ...p, dose_unit: e.target.value }))} style={inputStyle}>
                  {['mg','mcg','g','IU','capsules','ml','drops','servings'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Frecuencia' : 'Frequency'}>
                <select value={newSupp.frequency} onChange={e => setNewSupp(p => ({ ...p, frequency: e.target.value }))} style={inputStyle}>
                  {[['daily', lang === 'es' ? 'Diario' : 'Daily'],['2x_week', '2× / semana'],['3x_week', '3× / semana'],['5x_week', '5× / semana'],['as_needed', lang === 'es' ? 'Según necesidad' : 'As needed'],['high_stress_only', lang === 'es' ? 'Días de estrés' : 'High-stress days'],['cycling', lang === 'es' ? 'Ciclado' : 'Cycling']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label={lang === 'es' ? 'Momento' : 'Timing'}>
                <select value={newSupp.timing} onChange={e => setNewSupp(p => ({ ...p, timing: e.target.value }))} style={inputStyle}>
                  {[['morning', lang === 'es' ? 'Mañana' : 'Morning'],['midday', lang === 'es' ? 'Mediodía' : 'Midday'],['evening', lang === 'es' ? 'Tarde' : 'Evening'],['before_bed', lang === 'es' ? 'Antes de dormir' : 'Before bed'],['with_food', lang === 'es' ? 'Con comida' : 'With food'],['before_training', lang === 'es' ? 'Antes de entrenar' : 'Before training'],['after_training', lang === 'es' ? 'Después de entrenar' : 'After training']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label={lang === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}>
              <textarea value={newSupp.notes} onChange={e => setNewSupp(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />
            </Field>
            <button onClick={handleSaveSupp} disabled={savingSupp || !newSupp.name.trim()}
              style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`, border: 'none', borderRadius: '12px', color: '#041112', fontFamily: F.ui, fontSize: '14px', fontWeight: 700, cursor: (!newSupp.name.trim() || savingSupp) ? 'not-allowed' : 'pointer', opacity: (!newSupp.name.trim() || savingSupp) ? 0.6 : 1 }}>
              {savingSupp ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar suplemento' : 'Save supplement')}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'peptide' && (
        <Modal title={lang === 'es' ? 'Registrar péptido' : 'Log peptide'} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label={lang === 'es' ? 'Nombre del péptido *' : 'Peptide name *'}>
              <input type="text" value={newPep.name} onChange={e => setNewPep(p => ({ ...p, name: e.target.value }))} placeholder="BPC-157, CJC-1295, GHK-Cu..." style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Dosis *' : 'Dose *'}>
                <input type="number" value={newPep.dose} onChange={e => setNewPep(p => ({ ...p, dose: e.target.value }))} placeholder="250" style={inputStyle} min="0" />
              </Field>
              <Field label={lang === 'es' ? 'Unidad' : 'Unit'}>
                <select value={newPep.dose_unit} onChange={e => setNewPep(p => ({ ...p, dose_unit: e.target.value }))} style={inputStyle}>
                  {['mcg','mg','units','IU'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label={lang === 'es' ? 'Vía de administración' : 'Route'}>
              <select value={newPep.route} onChange={e => setNewPep(p => ({ ...p, route: e.target.value }))} style={inputStyle}>
                {[['subcutaneous','Subcutáneo'],['intramuscular','Intramuscular'],['oral','Oral'],['intranasal','Intranasal'],['sublingual','Sublingual']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label={lang === 'es' ? 'Inicio del ciclo' : 'Cycle start'}>
                <input type="date" value={newPep.cycle_start} onChange={e => setNewPep(p => ({ ...p, cycle_start: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label={lang === 'es' ? 'Fin del ciclo (opcional)' : 'Cycle end (optional)'}>
                <input type="date" value={newPep.cycle_end} onChange={e => setNewPep(p => ({ ...p, cycle_end: e.target.value }))} style={inputStyle} />
              </Field>
            </div>
            <Field label={lang === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}>
              <textarea value={newPep.notes} onChange={e => setNewPep(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />
            </Field>
            <button onClick={handleSavePep} disabled={savingPep || !newPep.name.trim() || !newPep.dose}
              style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg, ${C.teal} 0%, ${C.cyan} 100%)`, border: 'none', borderRadius: '12px', color: '#041112', fontFamily: F.ui, fontSize: '14px', fontWeight: 700, cursor: (!newPep.name.trim() || !newPep.dose || savingPep) ? 'not-allowed' : 'pointer', opacity: (!newPep.name.trim() || !newPep.dose || savingPep) ? 0.6 : 1 }}>
              {savingPep ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar péptido' : 'Save peptide')}
            </button>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );

  // ── Main content ───────────────────────────────────────────────────────────

  const mainContent = (
    <div style={{ padding: isDesktop ? '32px 40px 64px' : '24px 20px 100px', maxWidth: isDesktop ? '1120px' : '680px', margin: '0 auto' }}>
      <PageHeader />
      <PlanGuidanceCard />
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
          {lang === 'es' ? 'Cargando tu plan...' : 'Loading your plan...'}
        </div>
      ) : (
        <>
          {nothingActive ? (
            <NothingActive />
          ) : (
            <>
              {supplementsSection}
              {showMedications && medicationsSection}
              {showPeptides && <PeptidesSection />}
            </>
          )}
          {trainingProgramSection}
        </>
      )}
      {showGlp1History && (
        <Modal title={lang === 'es' ? 'Historial GLP-1' : 'GLP-1 History'} onClose={() => setShowGlp1History(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '62vh', overflowY: 'auto', paddingRight: '2px' }}>
            {entries.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(6,19,22,0.35)', border: `0.5px solid ${C.cardBorder}`, borderRadius: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.text, flex: 1 }}>{fmtDate(e.date, lang)}</span>
                <span style={{ fontSize: '12px', color: C.textMuted }}>{getSiteShort(e.site, lang)}</span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', border: '0.5px solid rgba(103,232,249,0.22)', background: 'rgba(103,232,249,0.07)', fontSize: '12px', fontWeight: 700, color: C.cyan }}>{Number(e.dose)} mg</span>
                <button
                  type="button"
                  onClick={() => e.notes && setSelectedGlp1Note(e.notes)}
                  title={e.notes ? (lang === 'es' ? 'Ver nota' : 'View note') : (lang === 'es' ? 'Sin nota' : 'No note')}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '999px',
                    border: `0.5px solid ${e.notes ? 'rgba(45,212,191,0.35)' : C.cardBorder}`,
                    background: e.notes ? 'rgba(45,212,191,0.08)' : 'rgba(6,19,22,0.25)',
                    color: e.notes ? C.teal : C.textMuted,
                    cursor: e.notes ? 'pointer' : 'default',
                    fontSize: '13px',
                    fontFamily: F.ui,
                  }}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {selectedGlp1Note && (
        <Modal title={lang === 'es' ? 'Nota de registro' : 'Entry note'} onClose={() => setSelectedGlp1Note(null)}>
          <p style={{ margin: 0, color: C.text, fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {selectedGlp1Note}
          </p>
        </Modal>
      )}

      {modals}
    </div>
  );

  // ── Mobile ─────────────────────────────────────────────────────────────────

  const mobileContent = (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: F.ui, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${C.teal}20 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle, ${C.cyan}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{mainContent}</div>
      <NavBar />
    </div>
  );

  // ── Desktop ────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: F.ui, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'fixed', top: '-15%', left: '10%', width: '40%', height: '40%', background: `radial-gradient(circle, ${C.teal}18 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '-15%', right: '5%', width: '40%', height: '40%', background: `radial-gradient(circle, ${C.cyan}15 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <DesktopSidebar currentPath="/protocol" />
        <div style={{ marginLeft: '200px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
          <DesktopTopBar />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {mainContent}
          </div>
        </div>
      </div>
    );
  }

  return mobileContent;
}
