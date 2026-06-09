'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import NavBar from '@/components/NavBar';
import DesktopSidebar from '@/components/DesktopSidebar';
import DesktopTopBar from '@/components/DesktopTopBar';
import { MeridianPageShell } from '@/components/MeridianPageShell';
import { MeridianPageHeader } from '@/components/MeridianPageHeader';
import type { HealthEvent, LabDocument } from '@/types/database';
import {
  getPastHealthEvents,
  getUpcomingHealthEvents,
} from '@/lib/timeline/healthEvents';
import { getLabDocuments } from '@/lib/timeline/labDocuments';
import { AppointmentCard } from '@/components/timeline/AppointmentCard';
import { AppointmentModal } from '@/components/timeline/AppointmentModal';
import { LabDocumentList } from '@/components/timeline/LabDocumentList';
import { LabUploadModal } from '@/components/timeline/LabUploadModal';
import { useMeridianLanguage } from '@/lib/i18n';

type TimelineTab = 'upcoming' | 'past' | 'labs';
type AppointmentModalMode = 'create' | 'edit' | 'view';

const colors = {
  background: '#061316',
  backgroundDeep: '#02090B',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  card: 'rgba(7, 29, 31, 0.72)',
  cardSoft: 'rgba(255,255,255,0.035)',
  cardBorder: 'rgba(103,232,249,0.13)',
  cardBorderActive: 'rgba(45,212,191,0.34)',
};

const fonts = {
  heading: 'var(--font-fraunces), "Fraunces", serif',
  ui: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
};

// ── Breakpoint helpers ────────────────────────────────────────────────────────
const DESKTOP_BP = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BP}px)`);
    setIsDesktop(mq.matches);

    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    color: colors.text,
    background:
      'radial-gradient(circle at 50% 0%, rgba(45,212,191,0.08) 0%, rgba(45,212,191,0.025) 28%, transparent 58%), linear-gradient(180deg, #061316 0%, #02090B 100%)',
    padding: '44px 20px 120px',
    fontFamily: fonts.ui,
  },
  shell: {
    width: '100%',
    maxWidth: 680,
    margin: '0 auto',
  },
  eyebrow: {
    margin: '0 0 12px',
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 1,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  hero: {
    marginBottom: 26,
  },
  heroTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
  },
  title: {
    margin: 0,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 'clamp(26px, 6vw, 34px)',
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.04em',
    textShadow: '0 16px 42px rgba(103,232,249,0.10)',
  },
  subtitle: {
    margin: '8px 0 0',
    maxWidth: 360,
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 1.65,
  },
  primaryButton: {
    border: `1px solid ${colors.cardBorderActive}`,
    borderRadius: 14,
    padding: '8px 12px',
    color: colors.teal,
    background:
      'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(103,232,249,0.045))',
    boxShadow:
      '0 12px 32px rgba(45,212,191,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 9,
    marginBottom: 16,
    marginTop: 20,
  },
  statCard: {
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 22,
    padding: '14px 15px',
    background: 'rgba(7, 29, 31, 0.50)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
  },
  statLabel: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  statValue: {
    margin: '10px 0 0',
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 700,
  },
  tabWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 18,
    padding: 6,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 22,
    background: 'rgba(2, 9, 11, 0.46)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
  },
  section: {
    display: 'grid',
    gap: 12,
  },
  emptyCard: {
    minHeight: 236,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed rgba(103,232,249,0.18)',
    borderRadius: 30,
    background:
      'linear-gradient(180deg, rgba(7,29,31,0.62), rgba(2,9,11,0.40))',
    boxShadow:
      '0 22px 60px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.035)',
    padding: 24,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 42,
    height: 42,
    margin: '0 auto 15px',
    borderRadius: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.cardBorderActive}`,
    background: 'rgba(45,212,191,0.08)',
    color: colors.teal,
  },
  emptyTitle: {
    margin: 0,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: '-0.035em',
  },
  emptyDescription: {
    margin: '10px auto 0',
    maxWidth: 420,
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 1.6,
  },
  secondaryButton: {
    marginTop: 22,
    border: `1px solid ${colors.cardBorderActive}`,
    borderRadius: 16,
    padding: '11px 15px',
    color: colors.text,
    background: 'rgba(45,212,191,0.10)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: {
    marginBottom: 14,
    border: '1px solid rgba(248,113,113,0.22)',
    borderRadius: 18,
    background: 'rgba(248,113,113,0.08)',
    color: '#FECACA',
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.5,
  },
};

export default function HealthTimelinePage() {
  const [activeTab, setActiveTab] = useState<TimelineTab>('upcoming');
  const [upcomingEvents, setUpcomingEvents] = useState<HealthEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<HealthEvent[]>([]);
  const [labDocuments, setLabDocuments] = useState<LabDocument[]>([]);
  const [selectedAppointment, setSelectedAppointment] =
    useState<HealthEvent | null>(null);
  const [appointmentModalMode, setAppointmentModalMode] =
    useState<AppointmentModalMode>('create');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isLabUploadModalOpen, setIsLabUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useMeridianLanguage();
  const isEs = lang === 'es';
  const copy = {
    eyebrow: isEs ? 'Agenda de salud' : 'Health agenda',
    title: isEs ? 'Agenda' : 'Agenda',
    subtitle: isEs
      ? 'Organiza tus citas médicas, laboratorios y seguimientos en un solo lugar.'
      : 'Organize appointments, labs, and follow-ups in one place.',
    upcoming: isEs ? 'Próximas' : 'Upcoming',
    past: isEs ? 'Historial' : 'History',
    labs: isEs ? 'Laboratorios' : 'Labs',
    addAppointment: isEs ? '+ Añadir cita' : '+ Add appointment',
    emptyUpcomingTitle: isEs ? 'No tienes próximas citas.' : 'No upcoming appointments.',
    emptyPastTitle: isEs ? 'No hay historial todavía.' : 'No history yet.',
    emptyUpcomingDescription: isEs
      ? 'Añade tu próxima cita o fecha importante para preparar documentos, preguntas y seguimiento.'
      : 'Add your next appointment or important health date to prepare documents, questions, and follow-up.',
    emptyPastDescription: isEs
      ? 'Cuando completes una cita, aparecerá aquí para que puedas revisar notas y próximos pasos.'
      : 'Completed appointments will appear here so you can review notes and next steps.',
    viewUpcoming: isEs ? 'Ver próximas' : 'View upcoming',
    loadError: isEs ? 'No pudimos cargar tu agenda de salud.' : 'We could not load your health agenda.',
  };

  async function loadTimelineData() {
    setIsLoading(true);
    setError(null);

    try {
      const [upcoming, past, labs] = await Promise.all([
        getUpcomingHealthEvents(),
        getPastHealthEvents(),
        getLabDocuments(),
      ]);

      setUpcomingEvents(upcoming);
      setPastEvents(past);
      setLabDocuments(labs);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : copy.loadError,
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTimelineData();
  }, []);

  const currentEvents = useMemo(() => {
    return activeTab === 'upcoming' ? upcomingEvents : pastEvents;
  }, [activeTab, upcomingEvents, pastEvents]);

  function openCreateAppointmentModal() {
    setSelectedAppointment(null);
    setAppointmentModalMode('create');
    setIsAppointmentModalOpen(true);
  }

  function openViewAppointmentModal(event: HealthEvent) {
    setSelectedAppointment(event);
    setAppointmentModalMode('view');
    setIsAppointmentModalOpen(true);
  }

  function handleAppointmentModalClose() {
    setIsAppointmentModalOpen(false);
    setSelectedAppointment(null);
  }

  async function handleAppointmentSaved() {
    await loadTimelineData();
  }

  async function handleAppointmentDeleted() {
    await loadTimelineData();
  }

  async function handleLabUploaded() {
    await loadTimelineData();
  }

  async function handleLabListChanged() {
    await loadTimelineData();
  }

  const isDesktop = useIsDesktop();

  const content = (
    <>
      <MeridianPageShell>
        <MeridianPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />

          <section style={styles.statsGrid}>
            <MiniStat label={copy.upcoming} value={upcomingEvents.length} />
            <MiniStat label={copy.past} value={pastEvents.length} />
            <MiniStat label={copy.labs} value={labDocuments.length} />
          </section>

          {error ? <div style={styles.error}>{error}</div> : null}

          <section style={styles.tabWrap}>
            <TimelineTabButton
              label={copy.upcoming}
              isActive={activeTab === 'upcoming'}
              onClick={() => setActiveTab('upcoming')}
            />
            <TimelineTabButton
              label={copy.past}
              isActive={activeTab === 'past'}
              onClick={() => setActiveTab('past')}
            />
            <TimelineTabButton
              label={copy.labs}
              isActive={activeTab === 'labs'}
              onClick={() => setActiveTab('labs')}
            />
          </section>

          {isLoading ? (
            <TimelineLoadingState />
          ) : activeTab === 'labs' ? (
            <LabDocumentList
              labs={labDocuments}
              onUploadClick={() => setIsLabUploadModalOpen(true)}
              onChanged={handleLabListChanged}
            />
          ) : (
            <EventsSection
              events={currentEvents}
              emptyTitle={
                activeTab === 'upcoming'
                  ? copy.emptyUpcomingTitle
                  : copy.emptyPastTitle
              }
              emptyDescription={
                activeTab === 'upcoming'
                  ? copy.emptyUpcomingDescription
                  : copy.emptyPastDescription
              }
              emptyActionLabel={
                activeTab === 'upcoming' ? copy.addAppointment : copy.viewUpcoming
              }
              onEmptyAction={() => {
                if (activeTab === 'upcoming') {
                  openCreateAppointmentModal();
                } else {
                  setActiveTab('upcoming');
                }
              }}
              onViewDetails={openViewAppointmentModal}
            />
          )}
      </MeridianPageShell>

      <AppointmentModal
          isOpen={isAppointmentModalOpen}
          mode={appointmentModalMode}
          appointment={selectedAppointment}
          onClose={handleAppointmentModalClose}
          onSaved={handleAppointmentSaved}
          onDeleted={handleAppointmentDeleted}
        />

        <LabUploadModal
          isOpen={isLabUploadModalOpen}
          onClose={() => setIsLabUploadModalOpen(false)}
          onUploaded={handleLabUploaded}
        />

      <NavBar />
    </>
  );


  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: fonts.ui, display: 'flex', position: 'relative', overflow: 'hidden' }}>

        {/* Ambient orbs */}
        <div style={{ position: 'fixed', top: '-15%', left: '10%', width: '40%', height: '40%', background: `radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '-15%', right: '5%', width: '40%', height: '40%', background: `radial-gradient(circle, rgba(103,232,249,0.10) 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

        <DesktopSidebar currentPath="/timeline" />

        <div style={{ marginLeft: '200px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
          <DesktopTopBar />

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '32px 40px 64px', maxWidth: '1120px', margin: '0 auto' }}>

              {/* ── Page header ── */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.teal, boxShadow: `0 0 6px rgba(45,212,191,0.6)` }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted }}>
                    {copy.eyebrow}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <h1 style={{ fontFamily: fonts.heading, fontSize: '28px', fontWeight: 700, color: colors.text, margin: '0 0 4px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {copy.title}
                    </h1>
                    <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>
                      {copy.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateAppointmentModal}
                    style={{ padding: '9px 20px', background: `linear-gradient(135deg, ${colors.teal} 0%, ${colors.cyan} 100%)`, border: 'none', borderRadius: '20px', color: colors.background, fontFamily: fonts.ui, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {copy.addAppointment}
                  </button>
                </div>
              </div>

              {/* ── Stats row ── */}
              <div style={{ display: 'flex', gap: '0', borderBottom: `1px solid ${colors.cardBorder}`, marginBottom: '24px' }}>
                {[
                  { label: copy.upcoming, value: upcomingEvents.length, tab: 'upcoming' as TimelineTab },
                  { label: copy.past, value: pastEvents.length, tab: 'past' as TimelineTab },
                  { label: copy.labs, value: labDocuments.length, tab: 'labs' as TimelineTab },
                ].map(stat => {
                  const isActive = activeTab === stat.tab
                  return (
                    <button key={stat.tab} type="button" onClick={() => setActiveTab(stat.tab)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', marginRight: '32px', background: 'none', border: 'none', borderBottom: isActive ? `1.5px solid ${colors.teal}` : '1.5px solid transparent', cursor: 'pointer', fontFamily: fonts.ui, outline: 'none', transition: 'border-color 0.15s', marginBottom: '-1px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: colors.text, lineHeight: 1 }}>{stat.value}</span>
                      <span style={{ fontSize: '11px', color: isActive ? colors.teal : colors.textMuted, fontWeight: 600 }}>{stat.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '12px', background: 'rgba(248,113,113,0.08)', color: '#FECACA', fontSize: '13px' }}>
                  {error}
                </div>
              )}

              {/* ── Content area ── */}
              {isLoading ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ height: '96px', borderRadius: '14px', border: `1px solid ${colors.cardBorder}`, background: colors.cardSoft, opacity: 0.6 }} />
                  ))}
                </div>
              ) : activeTab === 'labs' ? (
                <LabDocumentList
                  labs={labDocuments}
                  onUploadClick={() => setIsLabUploadModalOpen(true)}
                  onChanged={handleLabListChanged}
                />
              ) : (
                <EventsSection
                  events={currentEvents}
                  emptyTitle={activeTab === 'upcoming' ? copy.emptyUpcomingTitle : copy.emptyPastTitle}
                  emptyDescription={activeTab === 'upcoming' ? copy.emptyUpcomingDescription : copy.emptyPastDescription}
                  emptyActionLabel={activeTab === 'upcoming' ? copy.addAppointment : copy.viewUpcoming}
                  onEmptyAction={() => { if (activeTab === 'upcoming') { openCreateAppointmentModal(); } else { setActiveTab('upcoming'); } }}
                  onViewDetails={openViewAppointmentModal}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          mode={appointmentModalMode}
          appointment={selectedAppointment}
          onClose={handleAppointmentModalClose}
          onSaved={handleAppointmentSaved}
          onDeleted={handleAppointmentDeleted}
        />
        <LabUploadModal
          isOpen={isLabUploadModalOpen}
          onClose={() => setIsLabUploadModalOpen(false)}
          onUploaded={handleLabUploaded}
        />
      </div>
    );
  }

  return content;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <article style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </article>
  );
}

function TimelineTabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const colors = {
    text: '#EAFBF7',
    textMuted: '#5F8E85',
    cardBorderActive: 'rgba(45,212,191,0.34)',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: isActive ? `1px solid ${colors.cardBorderActive}` : '1px solid transparent',
        borderRadius: 16,
        padding: '12px 10px',
        color: isActive ? colors.text : colors.textMuted,
        background: isActive ? 'linear-gradient(135deg, rgba(45,212,191,0.13), rgba(103,232,249,0.055))' : 'transparent',
        boxShadow: isActive ? '0 10px 30px rgba(45,212,191,0.075), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.02em',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function TimelineLoadingState() {
  const colors = { cardBorder: 'rgba(103,232,249,0.13)', cardSoft: 'rgba(255,255,255,0.035)' };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ height: 128, borderRadius: 28, border: `1px solid ${colors.cardBorder}`, background: colors.cardSoft, opacity: 0.72 }} />
      ))}
    </div>
  );
}

function EventsSection({
  events,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onViewDetails,
}: {
  events: HealthEvent[];
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  onEmptyAction: () => void;
  onViewDetails: (event: HealthEvent) => void;
}) {
  const styles = {
    section: { display: 'grid', gap: 12 } as const,
  };
  if (!events.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return (
    <section style={styles.section}>
      {events.map((event) => (
        <AppointmentCard key={event.id} event={event} onViewDetails={onViewDetails} />
      ))}
    </section>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const colors = {
    text: '#EAFBF7', textSoft: '#9ACBC1',
    teal: '#2DD4BF', cardBorderActive: 'rgba(45,212,191,0.34)',
  };
  const fonts = { heading: 'var(--font-fraunces), "Fraunces", serif' };
  return (
    <section style={{ minHeight: 236, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(103,232,249,0.18)', borderRadius: 30, background: 'linear-gradient(180deg, rgba(7,29,31,0.62), rgba(2,9,11,0.40))', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ width: 42, height: 42, margin: '0 auto 15px', borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.cardBorderActive}`, background: 'rgba(45,212,191,0.08)', color: colors.teal }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="14" height="13" rx="2.2" /><path d="M6.5 2.5v3" /><path d="M13.5 2.5v3" /><path d="M3 8h14" /><path d="M6.5 11h2" /><path d="M11.5 11h2" /><path d="M6.5 14h2" />
          </svg>
        </div>
        <h2 style={{ margin: 0, color: colors.text, fontFamily: fonts.heading, fontSize: 24, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.035em' }}>{title}</h2>
        <p style={{ margin: '10px auto 0', maxWidth: 420, color: colors.textSoft, fontSize: 14, lineHeight: 1.6 }}>{description}</p>
        <button type="button" onClick={onAction} style={{ marginTop: 22, border: `1px solid ${colors.cardBorderActive}`, borderRadius: 16, padding: '11px 15px', color: colors.text, background: 'rgba(45,212,191,0.10)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
