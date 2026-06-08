'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  HealthEvent,
  HealthEventStatus,
  HealthEventType,
  LabDocument,
  PrepStatus,
} from '@/types/database';
import {
  createHealthEvent,
  deleteHealthEvent,
  updateHealthEvent,
} from '@/lib/timeline/healthEvents';
import {
  downloadLabDocument,
  getLabDocumentsByIds,
} from '@/lib/timeline/labDocuments';
import {
  buildStartsAt,
  formatAppointmentDateTime,
  formatLabDate,
  splitStartsAt,
} from '@/lib/timeline/dateFormat';
import { buildLabShareMailto } from '@/lib/timeline/mailto';
import { LabMultiSelect } from './LabMultiSelect';
import { useMeridianLanguage } from '@/lib/i18n';

type AppointmentModalMode = 'create' | 'edit' | 'view';

const SPECIALTY_OPTIONS = [
  'Primary Care',
  'Endocrinology',
  'Gynecology',
  'Nutrition',
  'Dermatology',
  'Cardiology',
  'Gastroenterology',
  'Lab Appointment',
  'Imaging / X-ray / MRI',
  'InBody / Body Composition',
  'Dental',
  'Other',
];

type AppointmentFormState = {
  event_type: HealthEventType;
  title: string;
  specialty: string;
  provider_name: string;
  date: string;
  time: string;
  location: string;
  is_virtual: boolean;
  reason: string;
  symptoms_notes: string;
  medications_to_review: string;
  supplements_to_review: string;
  related_lab_ids: string[];
  things_to_bring: string;
  user_questions: string;
  prep_status: PrepStatus;
  outcome_notes: string;
  follow_up_tasks: string;
  follow_up_date: string;
  status: HealthEventStatus;
};

const EMPTY_FORM: AppointmentFormState = {
  event_type: 'appointment',
  title: '',
  specialty: 'Primary Care',
  provider_name: '',
  date: '',
  time: '',
  location: '',
  is_virtual: false,
  reason: '',
  symptoms_notes: '',
  medications_to_review: '',
  supplements_to_review: '',
  related_lab_ids: [],
  things_to_bring: '',
  user_questions: '',
  prep_status: 'not_started',
  outcome_notes: '',
  follow_up_tasks: '',
  follow_up_date: '',
  status: 'upcoming',
};

function buildFormFromAppointment(
  appointment: HealthEvent | null,
): AppointmentFormState {
  if (!appointment) {
    return EMPTY_FORM;
  }

  const splitDate = splitStartsAt(appointment.starts_at);

  return {
    event_type: appointment.event_type,
    title: appointment.title ?? '',
    specialty: appointment.specialty,
    provider_name: appointment.provider_name ?? '',
    date: splitDate.date,
    time: splitDate.time,
    location: appointment.location ?? '',
    is_virtual: appointment.is_virtual,
    reason: appointment.reason ?? '',
    symptoms_notes: appointment.symptoms_notes ?? '',
    medications_to_review: appointment.medications_to_review ?? '',
    supplements_to_review: appointment.supplements_to_review ?? '',
    related_lab_ids: appointment.related_lab_ids ?? [],
    things_to_bring: appointment.things_to_bring ?? '',
    user_questions: appointment.user_questions ?? '',
    prep_status: appointment.prep_status,
    outcome_notes: appointment.outcome_notes ?? '',
    follow_up_tasks: appointment.follow_up_tasks ?? '',
    follow_up_date: appointment.follow_up_date ?? '',
    status: appointment.status,
  };
}

function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function AppointmentModal({
  isOpen,
  mode,
  appointment,
  onClose,
  onSaved,
  onDeleted,
}: {
  isOpen: boolean;
  mode: AppointmentModalMode;
  appointment: HealthEvent | null;
  onClose: () => void;
  onSaved: (event: HealthEvent) => void;
  onDeleted: () => void;
}) {
  const [currentMode, setCurrentMode] = useState<AppointmentModalMode>(mode);
  const [form, setForm] = useState<AppointmentFormState>(EMPTY_FORM);
  const [linkedLabs, setLinkedLabs] = useState<LabDocument[]>([]);
  const [isLoadingLabs, setIsLoadingLabs] = useState(false);
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useMeridianLanguage();
  const isEs = lang === 'es';

  const isViewMode = currentMode === 'view';
  const isEditMode = currentMode === 'edit';
  const isCreateMode = currentMode === 'create';

  const shouldShowAfterVisit =
    form.status === 'completed' || form.status === 'needs_follow_up';

  const modalTitle = useMemo(() => {
    if (isCreateMode) {
      return isEs ? 'Añadir cita' : 'Add appointment';
    }

    if (isEditMode) {
      return isEs ? 'Editar cita' : 'Edit appointment';
    }

    return isEs ? 'Detalle de la cita' : 'Appointment details';
  }, [isCreateMode, isEditMode, isEs]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCurrentMode(mode);
    setForm(buildFormFromAppointment(appointment));
    setLinkedLabs([]);
    setError(null);
  }, [isOpen, mode, appointment]);

  useEffect(() => {
    if (!isOpen || !appointment?.related_lab_ids?.length) {
      setLinkedLabs([]);
      return;
    }

    async function loadLinkedLabs() {
      setIsLoadingLabs(true);

      try {
        const labs = await getLabDocumentsByIds(appointment.related_lab_ids);
        setLinkedLabs(labs);
      } catch {
        setLinkedLabs([]);
      } finally {
        setIsLoadingLabs(false);
      }
    }

    void loadLinkedLabs();
  }, [isOpen, appointment]);

  if (!isOpen) {
    return null;
  }

  if (!appointment && mode !== 'create') {
    return null;
  }

  function updateField<K extends keyof AppointmentFormState>(
    key: K,
    value: AppointmentFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const startsAt = buildStartsAt(form.date, form.time);

    if (!form.specialty.trim()) {
      setError(isEs ? 'Selecciona una especialidad.' : 'Select a specialty.');
      return;
    }

    if (!startsAt) {
      setError(isEs ? 'Selecciona fecha y hora para la cita.' : 'Select a date and time for the appointment.');
      return;
    }

    setIsSaving(true);

    const payload = {
      event_type: form.event_type,
      title: cleanOptional(form.title) ?? form.specialty,
      specialty: form.specialty,
      provider_name: cleanOptional(form.provider_name),
      location: form.is_virtual ? null : cleanOptional(form.location),
      is_virtual: form.is_virtual,
      starts_at: startsAt,
      reason: cleanOptional(form.reason),
      symptoms_notes: cleanOptional(form.symptoms_notes),
      medications_to_review: cleanOptional(form.medications_to_review),
      supplements_to_review: cleanOptional(form.supplements_to_review),
      related_lab_ids: form.related_lab_ids,
      things_to_bring: cleanOptional(form.things_to_bring),
      user_questions: cleanOptional(form.user_questions),
      prep_status: form.prep_status,
      outcome_notes: shouldShowAfterVisit
        ? cleanOptional(form.outcome_notes)
        : null,
      follow_up_tasks: shouldShowAfterVisit
        ? cleanOptional(form.follow_up_tasks)
        : null,
      follow_up_date: shouldShowAfterVisit
        ? form.follow_up_date || null
        : null,
      status: form.status,
    };

    try {
      const savedEvent =
        isEditMode && appointment
          ? await updateHealthEvent(appointment.id, payload)
          : await createHealthEvent(payload);

      onSaved(savedEvent);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos guardar la cita.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!appointment) {
      return;
    }

    const confirmed = window.confirm(
      `¿Quieres eliminar esta cita de ${appointment.specialty}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteHealthEvent(appointment.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos eliminar la cita.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownloadLab(lab: LabDocument) {
    setActiveLabId(lab.id);
    setError(null);

    try {
      await downloadLabDocument(lab);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos descargar el lab.',
      );
    } finally {
      setActiveLabId(null);
    }
  }

  function handleSendByEmail() {
    if (!appointment) {
      return;
    }

    window.location.href = buildLabShareMailto(appointment, linkedLabs);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{modalTitle}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {isViewMode
                  ? 'Revisa la preparación, laboratorios y seguimiento.'
                  : 'Completa solo lo necesario por ahora. Puedes editarlo luego.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isViewMode ? (
                <button
                  type="button"
                  onClick={() => setCurrentMode('edit')}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                >
                  Editar
                </button>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>

        {isViewMode && appointment ? (
          <div className="grid gap-5 p-5">
            {error ? <ErrorMessage message={error} /> : null}

            <Section title="La cita">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadField label="Especialidad" value={appointment.specialty} />
                <ReadField
                  label="Proveedor"
                  value={appointment.provider_name || 'No indicado'}
                />
                <ReadField
                  label="Fecha y hora"
                  value={formatAppointmentDateTime(appointment.starts_at)}
                />
                <ReadField
                  label="Lugar"
                  value={
                    appointment.is_virtual
                      ? 'Virtual'
                      : appointment.location || 'No indicado'
                  }
                />
              </div>

              <ReadField
                label="Razón de visita"
                value={appointment.reason || 'No indicado'}
              />
            </Section>

            <Section title="Preparación">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadField
                  label="Síntomas / temas"
                  value={appointment.symptoms_notes || 'No indicado'}
                />
                <ReadField
                  label="Medicamentos"
                  value={appointment.medications_to_review || 'No indicado'}
                />
                <ReadField
                  label="Suplementos"
                  value={appointment.supplements_to_review || 'No indicado'}
                />
                <ReadField
                  label="Qué llevar"
                  value={appointment.things_to_bring || 'No indicado'}
                />
              </div>
            </Section>

            <Section title="Mis preguntas">
              <ReadField
                label="Preguntas para esta visita"
                value={appointment.user_questions || 'No indicado'}
              />
            </Section>

            <Section title="Linked Labs">
              {isLoadingLabs ? (
                <p className="text-sm text-slate-300">Cargando labs…</p>
              ) : linkedLabs.length ? (
                <div className="grid gap-3">
                  {linkedLabs.map((lab) => (
                    <div
                      key={lab.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{lab.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {lab.lab_date
                            ? formatLabDate(lab.lab_date)
                            : 'Sin fecha'}
                          {lab.specialty ? ` · ${lab.specialty}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={activeLabId === lab.id}
                        onClick={() => handleDownloadLab(lab)}
                        className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {activeLabId === lab.id ? (isEs ? 'Generando…' : 'Generating…') : (isEs ? 'Descargar' : 'Download')}
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      disabled
                      className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-500"
                    >
                      {isEs ? 'Descargar todo como ZIP · V2' : 'Download all as ZIP · V2'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendByEmail}
                      className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Send by email →
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300">
                  No hay laboratorios vinculados a esta cita.
                </p>
              )}
            </Section>

            {(appointment.status === 'completed' ||
              appointment.status === 'needs_follow_up') ? (
              <Section title="Después de la visita">
                <ReadField
                  label="Notas"
                  value={appointment.outcome_notes || 'No indicado'}
                />
                <ReadField
                  label="Tareas de seguimiento"
                  value={appointment.follow_up_tasks || 'No indicado'}
                />
                <ReadField
                  label="Fecha de seguimiento"
                  value={appointment.follow_up_date || 'No indicada'}
                />
              </Section>
            ) : null}

            <div className="flex justify-end border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-2xl border border-red-300/20 px-4 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar cita'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="grid gap-5 p-5">
            {error ? <ErrorMessage message={error} /> : null}

            <Section title="1. La cita">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Título">
                  <input
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Opcional"
                    className="input"
                  />
                </Field>

                <Field label="Especialidad">
                  <select
                    value={form.specialty}
                    onChange={(event) =>
                      updateField('specialty', event.target.value)
                    }
                    className="input"
                  >
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <option key={specialty} value={specialty}>
                        {specialty}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Proveedor">
                  <input
                    value={form.provider_name}
                    onChange={(event) =>
                      updateField('provider_name', event.target.value)
                    }
                    placeholder="Nombre del doctor / proveedor"
                    className="input"
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={form.event_type}
                    onChange={(event) =>
                      updateField('event_type', event.target.value as HealthEventType)
                    }
                    className="input"
                  >
                    <option value="appointment">Appointment</option>
                    <option value="lab">Lab</option>
                    <option value="inbody">InBody</option>
                    <option value="imaging">Imaging</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Fecha">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => updateField('date', event.target.value)}
                    className="input"
                  />
                </Field>

                <Field label="Hora">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => updateField('time', event.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.is_virtual}
                  onChange={(event) =>
                    updateField('is_virtual', event.target.checked)
                  }
                />
                Esta cita es virtual
              </label>

              {!form.is_virtual ? (
                <Field label="Lugar">
                  <input
                    value={form.location}
                    onChange={(event) =>
                      updateField('location', event.target.value)
                    }
                    placeholder="Oficina, hospital o dirección"
                    className="input"
                  />
                </Field>
              ) : null}

              <Field label="Razón de visita">
                <textarea
                  value={form.reason}
                  onChange={(event) => updateField('reason', event.target.value)}
                  rows={3}
                  placeholder="Resumen corto de 2–3 oraciones."
                  className="input min-h-28 resize-none"
                />
              </Field>
            </Section>

            <Section title="2. Preparación">
              <Field label="Síntomas / temas a mencionar">
                <textarea
                  value={form.symptoms_notes}
                  onChange={(event) =>
                    updateField('symptoms_notes', event.target.value)
                  }
                  rows={4}
                  className="input min-h-28 resize-none"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Medicamentos a revisar">
                  <textarea
                    value={form.medications_to_review}
                    onChange={(event) =>
                      updateField('medications_to_review', event.target.value)
                    }
                    rows={4}
                    className="input min-h-28 resize-none"
                  />
                </Field>

                <Field label="Suplementos a revisar">
                  <textarea
                    value={form.supplements_to_review}
                    onChange={(event) =>
                      updateField('supplements_to_review', event.target.value)
                    }
                    rows={4}
                    className="input min-h-28 resize-none"
                  />
                </Field>
              </div>

              <Field label="Things to bring">
                <textarea
                  value={form.things_to_bring}
                  onChange={(event) =>
                    updateField('things_to_bring', event.target.value)
                  }
                  rows={3}
                  className="input min-h-24 resize-none"
                />
              </Field>

              <Field label="Linked labs">
                <LabMultiSelect
                  selectedIds={form.related_lab_ids}
                  onChange={(ids) => updateField('related_lab_ids', ids)}
                />
              </Field>

              <Field label={isEs ? 'Estado de preparación' : 'Prep status'}>
                <select
                  value={form.prep_status}
                  onChange={(event) =>
                    updateField('prep_status', event.target.value as PrepStatus)
                  }
                  className="input"
                >
                  <option value="not_started">No iniciada</option>
                  <option value="in_progress">En progreso</option>
                  <option value="ready">Lista</option>
                </select>
              </Field>
            </Section>

            <Section title="3. Mis preguntas">
              <Field label="Preguntas para esta visita">
                <textarea
                  value={form.user_questions}
                  onChange={(event) =>
                    updateField('user_questions', event.target.value)
                  }
                  rows={4}
                  className="input min-h-28 resize-none"
                />
              </Field>

              <button
                type="button"
                disabled
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-500"
              >
                {isEs ? 'Sugerir preguntas y qué llevar · Próximamente' : 'Suggest questions & what to bring · Coming soon'}
              </button>
            </Section>

            <Section title="4. Después de la visita">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField('status', event.target.value as HealthEventStatus)
                  }
                  className="input"
                >
                  <option value="upcoming">Próxima</option>
                  <option value="completed">Completada</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="needs_follow_up">Requiere seguimiento</option>
                </select>
              </Field>

              {shouldShowAfterVisit ? (
                <>
                  <Field label={isEs ? 'Resultado y notas de la visita' : 'Outcome / visit notes'}>
                    <textarea
                      value={form.outcome_notes}
                      onChange={(event) =>
                        updateField('outcome_notes', event.target.value)
                      }
                      rows={4}
                      className="input min-h-28 resize-none"
                    />
                  </Field>

                  <Field label={isEs ? 'Tareas de seguimiento' : 'Follow-up tasks'}>
                    <textarea
                      value={form.follow_up_tasks}
                      onChange={(event) =>
                        updateField('follow_up_tasks', event.target.value)
                      }
                      rows={4}
                      className="input min-h-28 resize-none"
                    />
                  </Field>

                  <Field label="Follow-up date">
                    <input
                      type="date"
                      value={form.follow_up_date}
                      onChange={(event) =>
                        updateField('follow_up_date', event.target.value)
                      }
                      className="input"
                    />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Las notas posteriores aparecerán cuando marques la cita como
                  completada o con seguimiento pendiente.
                </p>
              )}
            </Section>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {isSaving ? 'Guardando…' : 'Guardar cita'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          background: rgb(255 255 255 / 0.04);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition: border-color 150ms ease;
        }

        .input::placeholder {
          color: rgb(100 116 139);
        }

        .input:focus {
          border-color: rgb(103 232 249 / 0.4);
        }

        .input option {
          background: rgb(15 23 42);
          color: white;
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {value}
      </p>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  );
}
