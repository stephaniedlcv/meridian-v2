'use client';

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';

type InjectionSite = 'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right';

type TirzepatideEntry = {
  id: string;
  user_id: string;
  date: string;
  dose: number;
  site: InjectionSite;
  notes: string | null;
  created_at: string;
};

type SiteOption = {
  value: InjectionSite;
  label: string;
  shortLabel: string;
  description: string;
};

const COLORS = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
};

const SITE_OPTIONS: SiteOption[] = [
  {
    value: 'abdomen_left',
    label: 'Abdomen izquierdo',
    shortLabel: 'Abd. izq.',
    description: 'Zona abdominal izquierda',
  },
  {
    value: 'thigh_right',
    label: 'Muslo derecho',
    shortLabel: 'Muslo der.',
    description: 'Zona frontal/lateral del muslo derecho',
  },
  {
    value: 'abdomen_right',
    label: 'Abdomen derecho',
    shortLabel: 'Abd. der.',
    description: 'Zona abdominal derecha',
  },
  {
    value: 'thigh_left',
    label: 'Muslo izquierdo',
    shortLabel: 'Muslo izq.',
    description: 'Zona frontal/lateral del muslo izquierdo',
  },
];

const SITE_ROTATION: Record<InjectionSite, InjectionSite> = {
  abdomen_left: 'thigh_right',
  thigh_right: 'abdomen_right',
  abdomen_right: 'thigh_left',
  thigh_left: 'abdomen_left',
};

const DOSE_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15];

const SEED_ENTRY = {
  date: '2026-05-20',
  dose: 2.5,
  site: 'abdomen_left' as InjectionSite,
  notes: 'Reducción de 5mg a 2.5mg para mantenimiento',
};

function getSiteLabel(site: string) {
  return SITE_OPTIONS.find((option) => option.value === site)?.label ?? 'No registrado';
}

function getSiteShortLabel(site: string) {
  return SITE_OPTIONS.find((option) => option.value === site)?.shortLabel ?? '—';
}

function getSuggestedSite(entries: TirzepatideEntry[]): InjectionSite {
  const lastSite = entries[0]?.site;

  if (!lastSite || !SITE_ROTATION[lastSite]) {
    return 'abdomen_left';
  }

  return SITE_ROTATION[lastSite];
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-PR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseLocalDate(date));
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const parsedDate = parseLocalDate(date);
  parsedDate.setDate(parsedDate.getDate() + days);

  return formatDateInput(parsedDate);
}

function getDaysSince(date: string) {
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entryDate = parseLocalDate(date);
  const diff = todayLocal.getTime() - entryDate.getTime();

  return Math.max(0, Math.floor(diff / 86_400_000));
}

function sortEntries(entries: TirzepatideEntry[]) {
  return [...entries].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background:
      'radial-gradient(circle at 20% 0%, rgba(45,212,191,0.15), transparent 30%), radial-gradient(circle at 80% 10%, rgba(103,232,249,0.12), transparent 28%), #061316',
    color: COLORS.text,
    fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '28px 18px 112px',
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
  },
  eyebrow: {
    margin: 0,
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: 'clamp(38px, 7vw, 68px)',
    lineHeight: 0.95,
    letterSpacing: '-0.06em',
    color: COLORS.text,
  },
  subtitle: {
    margin: 0,
    maxWidth: 680,
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 1.7,
  },
  section: {
    marginTop: 18,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  card: {
    border: `1px solid ${COLORS.cardBorder}`,
    background: COLORS.cardBg,
    borderRadius: 26,
    boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
    backdropFilter: 'blur(18px)',
  },
  statusCard: {
    padding: 18,
    minHeight: 132,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 18,
  },
  statusLabel: {
    margin: 0,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  statusValue: {
    margin: 0,
    fontFamily: '"Fraunces", Georgia, serif',
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 1,
    letterSpacing: '-0.04em',
  },
  statusHint: {
    margin: 0,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 1.5,
  },
  block: {
    padding: 20,
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  blockTitle: {
    margin: 0,
    fontFamily: '"Fraunces", Georgia, serif',
    color: COLORS.text,
    fontSize: 26,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  blockCopy: {
    margin: '6px 0 0',
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 1.6,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid rgba(45,212,191,0.36)`,
    background: 'rgba(45,212,191,0.1)',
    color: COLORS.teal,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  rotationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 12,
  },
  rotationCard: {
    position: 'relative',
    padding: 16,
    borderRadius: 22,
    border: `1px solid ${COLORS.cardBorder}`,
    background: 'rgba(6,19,22,0.44)',
    overflow: 'hidden',
  },
  rotationNumber: {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 14,
  },
  rotationName: {
    margin: 0,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 850,
  },
  rotationDescription: {
    margin: '7px 0 0',
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 1.5,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: 800,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${COLORS.cardBorder}`,
    background: 'rgba(6,19,22,0.72)',
    color: COLORS.text,
    borderRadius: 16,
    padding: '13px 14px',
    outline: 'none',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    minHeight: 104,
    resize: 'vertical',
    boxSizing: 'border-box',
    border: `1px solid ${COLORS.cardBorder}`,
    background: 'rgba(6,19,22,0.72)',
    color: COLORS.text,
    borderRadius: 16,
    padding: '13px 14px',
    outline: 'none',
    fontSize: 14,
    fontFamily: 'inherit',
    lineHeight: 1.6,
  },
  button: {
    width: '100%',
    border: 0,
    borderRadius: 18,
    padding: '15px 18px',
    background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.cyan})`,
    color: '#041112',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(45,212,191,0.18)',
  },
  buttonDisabled: {
    opacity: 0.58,
    cursor: 'not-allowed',
  },
  message: {
    marginTop: 14,
    borderRadius: 16,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.5,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  historyItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.9fr) minmax(110px, 0.6fr) minmax(150px, 1fr)',
    gap: 12,
    alignItems: 'center',
    border: `1px solid ${COLORS.cardBorder}`,
    background: 'rgba(6,19,22,0.44)',
    borderRadius: 20,
    padding: 14,
  },
  historyDate: {
    margin: 0,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 850,
  },
  historyMeta: {
    margin: '5px 0 0',
    color: COLORS.textMuted,
    fontSize: 12,
  },
  historyDose: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 'fit-content',
    borderRadius: 999,
    padding: '8px 11px',
    border: `1px solid rgba(103,232,249,0.24)`,
    color: COLORS.cyan,
    background: 'rgba(103,232,249,0.08)',
    fontSize: 13,
    fontWeight: 900,
  },
  historyNotes: {
    margin: 0,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 1.5,
  },
  emptyState: {
    border: `1px dashed rgba(103,232,249,0.22)`,
    borderRadius: 22,
    padding: 18,
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 1.6,
    background: 'rgba(6,19,22,0.28)',
  },
};

export default function ProtocolPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TirzepatideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [date, setDate] = useState(SEED_ENTRY.date);
  const [dose, setDose] = useState<number>(SEED_ENTRY.dose);
  const [site, setSite] = useState<InjectionSite>(SEED_ENTRY.site);
  const [notes, setNotes] = useState(SEED_ENTRY.notes);

  const latestEntry = entries[0] ?? null;
  const suggestedSite = getSuggestedSite(entries);
  const nextDate = latestEntry ? addDays(latestEntry.date, 7) : null;
  const daysSinceLast = latestEntry ? getDaysSince(latestEntry.date) : null;

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      setLoading(true);
      setErrorMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/onboarding/welcome');
        return;
      }

      const { data, error } = await supabase
        .from('tirzepatide_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (!isMounted) {
        return;
      }

      setUserId(user.id);

      if (error) {
        setErrorMessage('No pudimos cargar tu historial del protocolo. Intenta nuevamente.');
        setEntries([]);
      } else {
        const loadedEntries = sortEntries((data ?? []) as TirzepatideEntry[]);
        setEntries(loadedEntries);

        if (loadedEntries.length > 0) {
          setDate(formatDateInput(new Date()));
          setDose(Number(loadedEntries[0].dose));
          setSite(getSuggestedSite(loadedEntries));
          setNotes('');
        }
      }

      setLoading(false);
    }

    loadEntries();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      router.push('/onboarding/welcome');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const payload = {
      user_id: userId,
      date,
      dose,
      site,
      notes: notes.trim() ? notes.trim() : null,
    };

    const { data, error } = await supabase
      .from('tirzepatide_entries')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      const isDuplicate = error.code === '23505';

      setErrorMessage(
        isDuplicate
          ? 'Ya existe una entrada para esa fecha. Cambia la fecha o revisa el historial.'
          : 'No pudimos guardar la entrada. Intenta nuevamente.',
      );
      setSaving(false);
      return;
    }

    const updatedEntries = sortEntries([data as TirzepatideEntry, ...entries]);

    setEntries(updatedEntries);
    setDate(formatDateInput(new Date()));
    setDose(Number((data as TirzepatideEntry).dose));
    setSite(getSuggestedSite(updatedEntries));
    setNotes('');
    setSuccessMessage('Entrada guardada correctamente.');
    setSaving(false);
  }

  return (
    <>
      <main style={styles.page}>
        <div style={styles.shell}>
          <header style={styles.header}>
            <p style={styles.eyebrow}>Meridian Protocol</p>
            <h1 style={styles.title}>Protocolo</h1>
            <p style={styles.subtitle}>
              Registro de tirzepatide, rotación de sitio y seguimiento semanal para mantener una
              lectura clara de dosis, consistencia y patrón de aplicación.
            </p>
          </header>

          <section style={styles.section}>
            <div style={styles.grid}>
              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>Dosis actual</p>
                  <p style={styles.statusValue}>{latestEntry ? `${Number(latestEntry.dose)} mg` : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {latestEntry ? `Último registro: ${formatDate(latestEntry.date)}` : 'Sin registros guardados.'}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>Días desde última</p>
                  <p style={styles.statusValue}>{daysSinceLast !== null ? daysSinceLast : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {daysSinceLast !== null ? 'Calculado desde tu última entrada.' : 'Registra tu primera dosis.'}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>Próxima fecha</p>
                  <p style={styles.statusValue}>{nextDate ? formatDate(nextDate) : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {nextDate ? 'Estimado usando una cadencia semanal.' : 'Aparecerá luego del primer registro.'}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>Sitio sugerido</p>
                  <p style={styles.statusValue}>{getSiteShortLabel(suggestedSite)}</p>
                </div>
                <p style={styles.statusHint}>{getSiteLabel(suggestedSite)}</p>
              </article>
            </div>
          </section>

          <section style={styles.section}>
            <div style={{ ...styles.card, ...styles.block }}>
              <div style={styles.blockHeader}>
                <div>
                  <h2 style={styles.blockTitle}>Mapa de rotación</h2>
                  <p style={styles.blockCopy}>
                    La rotación recomendada sigue el orden: abdomen izquierdo → muslo derecho →
                    abdomen derecho → muslo izquierdo.
                  </p>
                </div>
                <span style={styles.badge}>Sugerido: {getSiteShortLabel(suggestedSite)}</span>
              </div>

              <div style={styles.rotationGrid}>
                {SITE_OPTIONS.map((option, index) => {
                  const isSuggested = option.value === suggestedSite;
                  const isLatest = latestEntry?.site === option.value;

                  return (
                    <article
                      key={option.value}
                      style={{
                        ...styles.rotationCard,
                        borderColor: isSuggested ? 'rgba(45,212,191,0.62)' : COLORS.cardBorder,
                        background: isSuggested
                          ? 'linear-gradient(135deg, rgba(45,212,191,0.14), rgba(103,232,249,0.06))'
                          : 'rgba(6,19,22,0.44)',
                      }}
                    >
                      <div
                        style={{
                          ...styles.rotationNumber,
                          borderColor: isSuggested ? 'rgba(45,212,191,0.62)' : COLORS.cardBorder,
                          color: isSuggested ? COLORS.teal : COLORS.cyan,
                        }}
                      >
                        {index + 1}
                      </div>
                      <p style={styles.rotationName}>{option.label}</p>
                      <p style={styles.rotationDescription}>
                        {option.description}
                        {isLatest ? ' · Último sitio usado' : ''}
                        {isSuggested ? ' · Próximo sugerido' : ''}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <form style={{ ...styles.card, ...styles.block }} onSubmit={handleSubmit}>
              <div style={styles.blockHeader}>
                <div>
                  <h2 style={styles.blockTitle}>Nueva entrada</h2>
                  <p style={styles.blockCopy}>
                    Guarda la fecha, dosis, sitio de aplicación y cualquier nota relevante.
                  </p>
                </div>
              </div>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Fecha</span>
                  <input
                    style={styles.input}
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Dosis</span>
                  <select
                    style={styles.input}
                    value={dose}
                    onChange={(event) => setDose(Number(event.target.value))}
                    required
                  >
                    {DOSE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} mg
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Sitio</span>
                  <select
                    style={styles.input}
                    value={site}
                    onChange={(event) => setSite(event.target.value as InjectionSite)}
                    required
                  >
                    {SITE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={styles.field}>
                  <span style={styles.label}>Notas</span>
                  <textarea
                    style={styles.textarea}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ej. reducción de dosis, mantenimiento, síntomas, tolerancia o contexto relevante."
                  />
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  style={{
                    ...styles.button,
                    ...(saving || loading ? styles.buttonDisabled : {}),
                  }}
                  type="submit"
                  disabled={saving || loading}
                >
                  {saving ? 'Guardando...' : 'Guardar entrada'}
                </button>
              </div>

              {errorMessage ? (
                <div
                  style={{
                    ...styles.message,
                    border: '1px solid rgba(248,113,113,0.24)',
                    background: 'rgba(248,113,113,0.08)',
                    color: '#FCA5A5',
                  }}
                >
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div
                  style={{
                    ...styles.message,
                    border: '1px solid rgba(45,212,191,0.26)',
                    background: 'rgba(45,212,191,0.08)',
                    color: COLORS.teal,
                  }}
                >
                  {successMessage}
                </div>
              ) : null}
            </form>
          </section>

          <section style={styles.section}>
            <div style={{ ...styles.card, ...styles.block }}>
              <div style={styles.blockHeader}>
                <div>
                  <h2 style={styles.blockTitle}>Historial</h2>
                  <p style={styles.blockCopy}>
                    Entradas guardadas en orden descendente por fecha.
                  </p>
                </div>
              </div>

              {loading ? (
                <div style={styles.emptyState}>Cargando historial...</div>
              ) : entries.length === 0 ? (
                <div style={styles.emptyState}>
                  Todavía no hay entradas guardadas. El formulario está preparado con tu registro
                  inicial real para que puedas guardarlo primero.
                </div>
              ) : (
                <div style={styles.historyList}>
                  {entries.map((entry) => (
                    <article key={entry.id} style={styles.historyItem}>
                      <div>
                        <p style={styles.historyDate}>{formatDate(entry.date)}</p>
                        <p style={styles.historyMeta}>{getSiteLabel(entry.site)}</p>
                      </div>

                      <div>
                        <span style={styles.historyDose}>{Number(entry.dose)} mg</span>
                      </div>

                      <p style={styles.historyNotes}>{entry.notes || 'Sin notas registradas.'}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <NavBar />
    </>
  );
}
