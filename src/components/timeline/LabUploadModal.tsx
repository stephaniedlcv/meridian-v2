'use client';

import { useEffect, useState } from 'react';
import { uploadLabDocument } from '@/lib/timeline/labDocuments';
import type { LabDocument } from '@/types/database';

const SPECIALTY_OPTIONS = [
  '',
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

export function LabUploadModal({
  isOpen,
  onClose,
  onUploaded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (lab: LabDocument) => void;
}) {
  const [name, setName] = useState('');
  const [labDate, setLabDate] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName('');
    setLabDate('');
    setSpecialty('');
    setNotes('');
    setFile(null);
    setError(null);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Añade un nombre para el laboratorio.');
      return;
    }

    if (!file) {
      setError('Selecciona un PDF o imagen para subir.');
      return;
    }

    setIsSaving(true);

    try {
      const uploadedLab = await uploadLabDocument(file, {
        name,
        lab_date: labDate || null,
        specialty: specialty || null,
        notes: notes || null,
      });

      onUploaded(uploadedLab);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos subir el laboratorio.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Subir laboratorio
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Guarda PDFs o imágenes para vincularlos a tus próximas citas.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-5">
          {error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <Field label="Nombre del documento">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Thyroid Panel · March 2026"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha del laboratorio">
              <input
                type="date"
                value={labDate}
                onChange={(event) => setLabDate(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              />
            </Field>

            <Field label="Especialidad">
              <select
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {SPECIALTY_OPTIONS.map((option) => (
                  <option key={option || 'empty'} value={option}>
                    {option || 'Opcional'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Archivo">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-950"
            />
          </Field>

          <Field label="Notas">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Notas internas sobre este documento."
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
            />
          </Field>

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
              {isSaving ? 'Subiendo…' : 'Guardar laboratorio'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
