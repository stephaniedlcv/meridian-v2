'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import NavBar from '@/components/NavBar';
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    color: colors.text,
    background:
      'radial-gradient(circle at 50% 0%, rgba(45,212,191,0.08) 0%, rgba(45,212,191,0.025) 28%, transparent 58%), linear-gradient(180deg, #061316 0%, #02090B 100%)',
    padding: '24px 24px 100px',
    fontFamily: fonts.ui,
  },
  shell: {
    width: '100%',
    maxWidth: 640,
    margin: '0 auto',
  },
  eyebrow: {
    margin: '0 0 12px',
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: '0.07em',
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
    gap: 10,
    marginBottom: 16,
    marginTop: 24,
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
          : 'No pudimos cargar tu agenda de salud.',
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

  return (
    <>
      <main style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.hero}>
            <div style={styles.heroTop}>
              <div>
                <p style={styles.eyebrow}>Agenda de salud</p>
                <h1 style={styles.title}>Agenda</h1>
                <p style={styles.subtitle}>
                  Organiza tus citas médicas, laboratorios y seguimientos en un
                  solo lugar.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateAppointmentModal}
                style={styles.primaryButton}
              >
                + Añadir cita
              </button>
            </div>
          </section>

          <section style={styles.statsGrid}>
            <MiniStat label="Próximas" value={upcomingEvents.length} />
            <MiniStat label="Historial" value={pastEvents.length} />
            <MiniStat label="Labs" value={labDocuments.length} />
          </section>

          {error ? <div style={styles.error}>{error}</div> : null}

          <section style={styles.tabWrap}>
            <TimelineTabButton
              label="Próximas"
              isActive={activeTab === 'upcoming'}
              onClick={() => setActiveTab('upcoming')}
            />
            <TimelineTabButton
              label="Historial"
              isActive={activeTab === 'past'}
              onClick={() => setActiveTab('past')}
            />
            <TimelineTabButton
              label="Laboratorios"
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
                  ? 'No tienes próximas citas.'
                  : 'No hay historial todavía.'
              }
              emptyDescription={
                activeTab === 'upcoming'
                  ? 'Añade tu primera cita para empezar a organizar tu seguimiento de salud.'
                  : 'Cuando completes una cita, aparecerá aquí para que puedas revisar notas y próximos pasos.'
              }
              emptyActionLabel={
                activeTab === 'upcoming' ? '+ Añadir cita' : 'Ver próximas'
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
        </div>

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
      </main>

      <NavBar />
    </>
  );
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
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: isActive
          ? `1px solid ${colors.cardBorderActive}`
          : '1px solid transparent',
        borderRadius: 16,
        padding: '12px 10px',
        color: isActive ? colors.text : colors.textMuted,
        background: isActive
          ? 'linear-gradient(135deg, rgba(45,212,191,0.13), rgba(103,232,249,0.055))'
          : 'transparent',
        boxShadow: isActive
          ? '0 10px 30px rgba(45,212,191,0.075), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'none',
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
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          style={{
            height: 128,
            borderRadius: 28,
            border: `1px solid ${colors.cardBorder}`,
            background: colors.cardSoft,
            opacity: 0.72,
          }}
        />
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
        <AppointmentCard
          key={event.id}
          event={event}
          onViewDetails={onViewDetails}
        />
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
  return (
    <section style={styles.emptyCard}>
      <div style={{ maxWidth: 440 }}>
        <div style={styles.emptyIcon}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="14" height="13" rx="2.2" />
            <path d="M6.5 2.5v3" />
            <path d="M13.5 2.5v3" />
            <path d="M3 8h14" />
            <path d="M6.5 11h2" />
            <path d="M11.5 11h2" />
            <path d="M6.5 14h2" />
          </svg>
        </div>

        <h2 style={styles.emptyTitle}>{title}</h2>
        <p style={styles.emptyDescription}>{description}</p>

        <button type="button" onClick={onAction} style={styles.secondaryButton}>
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
