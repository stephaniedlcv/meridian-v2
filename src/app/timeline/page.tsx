'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HealthEvent, LabDocument } from '@/types/database';
import {
  getPastHealthEvents,
  getUpcomingHealthEvents,
} from '@/lib/timeline/healthEvents';
import {
  downloadLabDocument,
  getLabDocuments,
} from '@/lib/timeline/labDocuments';
import {
  formatAppointmentDateTime,
  formatLabDate,
} from '@/lib/timeline/dateFormat';

type TimelineTab = 'upcoming' | 'past' | 'labs';

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Próxima',
  completed: 'Completada',
  cancelled: 'Cancelada',
  needs_follow_up: 'Requiere seguimiento',
};

const PREP_STATUS_LABELS: Record<string, string> = {
  not_started: 'No iniciada',
  in_progress: 'En progreso',
  ready: 'Lista',
};

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function getPrepStatusLabel(status: string) {
  return PREP_STATUS_LABELS[status] ?? status;
}

function getLinkedLabsCount(event: HealthEvent) {
  return event.related_lab_ids?.length ?? 0;
}

export default function HealthTimelinePage() {
  const [activeTab, setActiveTab] = useState<TimelineTab>('upcoming');
  const [upcomingEvents, setUpcomingEvents] = useState<HealthEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<HealthEvent[]>([]);
  const [labDocuments, setLabDocuments] = useState<LabDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingLabId, setIsDownloadingLabId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function handleDownloadLab(lab: LabDocument) {
    setIsDownloadingLabId(lab.id);
    setError(null);

    try {
      await downloadLabDocument(lab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos generar el enlace de descarga.',
      );
    } finally {
      setIsDownloadingLabId(null);
    }
  }

  function handleComingSoon(action: string) {
    setNotice(`${action} se añadirá en el próximo task.`);
    window.setTimeout(() => setNotice(null), 3500);
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
              onClick={() => handleComingSoon('Añadir cita')}
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

        {notice ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
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
          <LabsSection
            labs={labDocuments}
            isDownloadingLabId={isDownloadingLabId}
            onUploadClick={() => handleComingSoon('Subir laboratorio')}
            onDownloadLab={handleDownloadLab}
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
                handleComingSoon('Añadir cita');
              } else {
                setActiveTab('upcoming');
              }
            }}
            onViewDetails={() => handleComingSoon('Ver detalles')}
          />
        )}
      </div>
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
        <article
          key={event.id}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                  {event.specialty}
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                  {getStatusLabel(event.status)}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-white">
                {event.provider_name || event.title || event.specialty}
              </h2>

              <p className="mt-1 text-sm text-slate-300">
                {formatAppointmentDateTime(event.starts_at)}
                {' · '}
                {event.is_virtual
                  ? 'Virtual'
                  : event.location || 'Lugar pendiente'}
              </p>

              {event.reason ? (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                  <span className="font-medium text-slate-100">Razón: </span>
                  {event.reason}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-white/5 px-3 py-1">
                  Labs vinculados: {getLinkedLabsCount(event)}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                  Prep: {getPrepStatusLabel(event.prep_status)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onViewDetails(event)}
              className="shrink-0 rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Ver detalles →
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function LabsSection({
  labs,
  isDownloadingLabId,
  onUploadClick,
  onDownloadLab,
}: {
  labs: LabDocument[];
  isDownloadingLabId: string | null;
  onUploadClick: () => void;
  onDownloadLab: (lab: LabDocument) => void;
}) {
  if (!labs.length) {
    return (
      <EmptyState
        title="No has subido laboratorios todavía."
        description="Sube PDFs o imágenes de laboratorios para vincularlos a tus próximas citas."
        actionLabel="+ Subir laboratorio"
        onAction={onUploadClick}
      />
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Laboratorios</h2>
          <p className="mt-1 text-sm text-slate-300">
            Documentos disponibles para vincular a tus citas.
          </p>
        </div>

        <button
          type="button"
          onClick={onUploadClick}
          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          + Subir laboratorio
        </button>
      </div>

      <div className="grid gap-3">
        {labs.map((lab) => (
          <article
            key={lab.id}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="font-medium text-white">{lab.name}</h3>
              <p className="mt-1 text-sm text-slate-300">
                {lab.lab_date ? formatLabDate(lab.lab_date) : 'Sin fecha'}
                {lab.specialty ? ` · ${lab.specialty}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {lab.file_name || 'Archivo guardado'}
              </p>
            </div>

            <button
              type="button"
              disabled={isDownloadingLabId === lab.id}
              onClick={() => onDownloadLab(lab)}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloadingLabId === lab.id ? 'Generando…' : 'Download'}
            </button>
          </article>
        ))}
      </div>
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
