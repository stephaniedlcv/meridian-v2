'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LabDocument } from '@/types/database';
import { getLabDocuments } from '@/lib/timeline/labDocuments';
import { formatLabDate } from '@/lib/timeline/dateFormat';

export function LabMultiSelect({
  selectedIds,
  onChange,
  disabled = false,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [labs, setLabs] = useState<LabDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLabs() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getLabDocuments();
      setLabs(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos cargar tus laboratorios.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLabs();
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleLab(id: string) {
    if (disabled) {
      return;
    }

    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    onChange([...selectedIds, id]);
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        Cargando laboratorios…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  if (!labs.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        No hay laboratorios subidos todavía. Podrás vincularlos cuando subas tu
        primer documento.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {labs.map((lab) => {
        const isSelected = selectedSet.has(lab.id);

        return (
          <button
            key={lab.id}
            type="button"
            disabled={disabled}
            onClick={() => toggleLab(lab.id)}
            className={[
              'flex items-start gap-3 rounded-2xl border p-3 text-left transition',
              isSelected
                ? 'border-cyan-300/40 bg-cyan-300/10'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs',
                isSelected
                  ? 'border-cyan-200 bg-cyan-200 text-slate-950'
                  : 'border-white/20 text-transparent',
              ].join(' ')}
            >
              ✓
            </span>

            <span>
              <span className="block text-sm font-medium text-white">
                {lab.name}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {lab.lab_date ? formatLabDate(lab.lab_date) : 'Sin fecha'}
                {lab.specialty ? ` · ${lab.specialty}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
