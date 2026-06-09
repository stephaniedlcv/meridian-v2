'use client';

import type { HealthEvent } from '@/types/database';
import { formatAppointmentDateTime } from '@/lib/timeline/dateFormat';
import { useMeridianLanguage } from '@/lib/i18n';

const STATUS_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    upcoming: 'Próxima',
    completed: 'Completada',
    cancelled: 'Cancelada',
    needs_follow_up: 'Requiere seguimiento',
  },
  en: {
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled',
    needs_follow_up: 'Needs follow-up',
  },
};

const PREP_STATUS_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    not_started: 'No iniciada',
    in_progress: 'En progreso',
    ready: 'Lista',
  },
  en: {
    not_started: 'Not started',
    in_progress: 'In progress',
    ready: 'Ready',
  },
};

export function AppointmentCard({
  event,
  onViewDetails,
}: {
  event: HealthEvent;
  onViewDetails: (event: HealthEvent) => void;
}) {
  const linkedLabsCount = event.related_lab_ids?.length ?? 0;
  const [lang] = useMeridianLanguage();
  const isEs = lang === 'es';

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {event.specialty}
            </span>

            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
              {STATUS_LABELS[lang][event.status] ?? event.status}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-white">
            {event.provider_name || event.title || event.specialty}
          </h2>

          <p className="mt-1 text-sm text-slate-300">
            {formatAppointmentDateTime(event.starts_at)}
            {' · '}
            {event.is_virtual ? 'Virtual' : event.location || (isEs ? 'Lugar pendiente' : 'Location pending')}
          </p>

          {event.reason ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
              <span className="font-medium text-slate-100">{isEs ? "Razón: " : "Reason: "}</span>
              {event.reason}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full bg-white/5 px-3 py-1">
              {isEs ? 'Labs vinculados' : 'Linked labs'}: {linkedLabsCount}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1">
              {isEs ? 'Preparación' : 'Prep'}: {PREP_STATUS_LABELS[lang][event.prep_status] ?? event.prep_status}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onViewDetails(event)}
          className="shrink-0 rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          {isEs ? 'Ver detalles' : 'View details'} →
        </button>
      </div>
    </article>
  );
}
