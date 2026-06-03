'use client';

import { useEffect, useMemo, useState } from 'react';
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
          : 'No pudimos cargar tus fechas importantes.',
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
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Meridian
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Fechas importantes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Organiza tus próximas citas, laboratorios y seguimientos en un
                solo lugar.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateAppointmentModal}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              + Añadir cita
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid grid-cols-3 gap-2">
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
          </div>
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
      className={[
        'rounded-2xl px-3 py-2.5 text-sm font-medium transition',
        isActive
          ? 'bg-white text-slate-950 shadow-lg shadow-black/20'
          : 'text-slate-300 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function TimelineLoadingState() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
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
    <section className="grid gap-3">
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
    <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-12 text-center">
      <div className="mx-auto max-w-md">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
