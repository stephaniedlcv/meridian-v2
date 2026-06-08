'use client';

import { useState } from 'react';
import type { LabDocument } from '@/types/database';
import {
  deleteLabDocument,
  downloadLabDocument,
} from '@/lib/timeline/labDocuments';
import { formatLabDate } from '@/lib/timeline/dateFormat';
import { useMeridianLanguage } from '@/lib/i18n';

function formatFileSize(size: number | null) {
  if (!size) {
    return 'Tamaño no disponible';
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function LabDocumentList({
  labs,
  onUploadClick,
  onChanged,
}: {
  labs: LabDocument[];
  onUploadClick: () => void;
  onChanged: () => void;
}) {
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useMeridianLanguage();
  const isEs = lang === 'es';

  async function handleDownload(lab: LabDocument) {
    setActiveLabId(lab.id);
    setError(null);

    try {
      await downloadLabDocument(lab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos descargar el laboratorio.',
      );
    } finally {
      setActiveLabId(null);
    }
  }

  async function handleDelete(lab: LabDocument) {
    const confirmed = window.confirm(
      `¿Quieres eliminar "${lab.name}"? Esta acción también eliminará el archivo guardado.`,
    );

    if (!confirmed) {
      return;
    }

    setActiveLabId(lab.id);
    setError(null);

    try {
      await deleteLabDocument(lab.id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos eliminar el laboratorio.',
      );
    } finally {
      setActiveLabId(null);
    }
  }

  if (!labs.length) {
    return (
      <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-12 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-lg font-semibold text-white">
            No has subido laboratorios todavía.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Sube PDFs o imágenes de laboratorios para vincularlos a tus próximas
            citas.
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="mt-6 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            + Subir laboratorio
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

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
        {labs.map((lab) => {
          const isBusy = activeLabId === lab.id;

          return (
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
                  {lab.file_name || 'Archivo guardado'} ·{' '}
                  {formatFileSize(lab.file_size)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDownload(lab)}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? (isEs ? 'Procesando…' : 'Processing…') : (isEs ? 'Descargar' : 'Download')}
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDelete(lab)}
                  className="rounded-2xl border border-red-300/20 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEs ? 'Eliminar' : 'Delete'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
