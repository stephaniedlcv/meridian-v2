'use client';

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';

type InjectionSite = 'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right';
type AppLanguage = 'es' | 'en';

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
  label: Record<AppLanguage, string>;
  shortLabel: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
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
    label: { es: 'Abdomen izquierdo', en: 'Left abdomen' },
    shortLabel: { es: 'Abd. izq.', en: 'Left abd.' },
    description: {
      es: 'Zona abdominal izquierda',
      en: 'Left abdominal area',
    },
  },
  {
    value: 'thigh_right',
    label: { es: 'Muslo derecho', en: 'Right thigh' },
    shortLabel: { es: 'Muslo der.', en: 'Right thigh' },
    description: {
      es: 'Zona frontal/lateral del muslo derecho',
      en: 'Front or outer area of the right thigh',
    },
  },
  {
    value: 'abdomen_right',
    label: { es: 'Abdomen derecho', en: 'Right abdomen' },
    shortLabel: { es: 'Abd. der.', en: 'Right abd.' },
    description: {
      es: 'Zona abdominal derecha',
      en: 'Right abdominal area',
    },
  },
  {
    value: 'thigh_left',
    label: { es: 'Muslo izquierdo', en: 'Left thigh' },
    shortLabel: { es: 'Muslo izq.', en: 'Left thigh' },
    description: {
      es: 'Zona frontal/lateral del muslo izquierdo',
      en: 'Front or outer area of the left thigh',
    },
  },
];

const SITE_ROTATION: Record<InjectionSite, InjectionSite> = {
  abdomen_left: 'thigh_right',
  thigh_right: 'abdomen_right',
  abdomen_right: 'thigh_left',
  thigh_left: 'abdomen_left',
};

const DOSE_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15];

function getSiteLabel(site: string, lang: AppLanguage) {
  return SITE_OPTIONS.find((option) => option.value === site)?.label[lang] ??
    (lang === 'en' ? 'Not recorded' : 'No registrado');
}

function getSiteShortLabel(site: string, lang: AppLanguage) {
  return SITE_OPTIONS.find((option) => option.value === site)?.shortLabel[lang] ?? '—';
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

function formatDate(date: string, lang: AppLanguage) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-PR', {
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

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'es';
  }

  const localValues = [
    window.localStorage.getItem('meridian_language'),
    window.localStorage.getItem('meridian-lang'),
    window.localStorage.getItem('meridianLang'),
    window.localStorage.getItem('language'),
    window.localStorage.getItem('lang'),
    window.localStorage.getItem('locale'),
  ].filter(Boolean) as string[];

  const rawLanguage =
    localValues[0] || document.documentElement.lang || window.navigator.language || 'es';

  return rawLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';
}

const COPY = {
  es: {
    eyebrow: '• PLAN DE SALUD',
    title: 'Plan',
    subtitleStrong: 'Tu plan activo.',
    subtitleLine: 'Registro semanal y rotación de sitio.',
    currentDose: 'Dosis actual',
    daysSinceLast: 'Días desde última',
    nextDate: 'Próxima fecha',
    suggestedSite: 'Sitio sugerido',
    noSavedRecords: 'Sin registros guardados.',
    firstDosePrompt: 'Registra tu primera dosis.',
    appearsAfterFirst: 'Aparecerá luego del primer registro.',
    calculatedFromLast: 'Calculado desde tu última entrada.',
    estimatedWeekly: 'Estimado usando una cadencia semanal.',
    lastRecord: 'Último registro',
    rotationMap: 'Mapa de rotación',
    rotationCopy:
      'La rotación recomendada sigue el orden: abdomen izquierdo → muslo derecho → abdomen derecho → muslo izquierdo.',
    suggested: 'Sugerido',
    lastSiteUsed: 'Último sitio usado',
    nextSuggested: 'Próximo sugerido',
    newEntry: 'Nueva entrada',
    newEntryCopy: 'Guarda la fecha, dosis, sitio de aplicación y cualquier nota relevante.',
    date: 'Fecha',
    dose: 'Dosis',
    site: 'Sitio',
    notes: 'Notas',
    notesPlaceholder:
      'Ej. reducción de dosis, mantenimiento, síntomas, tolerancia o contexto relevante.',
    saving: 'Guardando...',
    saveEntry: 'Guardar entrada',
    loadError: 'No pudimos cargar tu historial del plan. Intenta nuevamente.',
    duplicateError: 'Ya existe una entrada para esa fecha. Cambia la fecha o revisa el historial.',
    saveError: 'No pudimos guardar la entrada. Intenta nuevamente.',
    saved: 'Entrada guardada correctamente.',
    history: 'Historial',
    historyCopy: 'Entradas guardadas en orden descendente por fecha.',
    loadingHistory: 'Cargando historial...',
    emptyHistory:
      'Todavía no hay entradas guardadas. El formulario está listo para que el usuario registre su primera dosis cuando corresponda.',
    noNotes: 'Sin notas registradas.',
  },
  en: {
    eyebrow: '• HEALTH PLAN',
    title: 'Plan',
    subtitleStrong: 'Your active plan.',
    subtitleLine: 'Weekly tracking and site rotation.',
    currentDose: 'Current dose',
    daysSinceLast: 'Days since last',
    nextDate: 'Next date',
    suggestedSite: 'Suggested site',
    noSavedRecords: 'No saved records.',
    firstDosePrompt: 'Log your first dose.',
    appearsAfterFirst: 'This will appear after your first entry.',
    calculatedFromLast: 'Calculated from your latest entry.',
    estimatedWeekly: 'Estimated using a weekly cadence.',
    lastRecord: 'Last record',
    rotationMap: 'Rotation map',
    rotationCopy:
      'The recommended rotation follows this order: left abdomen → right thigh → right abdomen → left thigh.',
    suggested: 'Suggested',
    lastSiteUsed: 'Last site used',
    nextSuggested: 'Next suggested',
    newEntry: 'New entry',
    newEntryCopy: 'Save the date, dose, injection site, and any relevant notes.',
    date: 'Date',
    dose: 'Dose',
    site: 'Site',
    notes: 'Notes',
    notesPlaceholder:
      'Example: dose reduction, maintenance, symptoms, tolerance, or relevant context.',
    saving: 'Saving...',
    saveEntry: 'Save entry',
    loadError: 'We could not load your plan history. Please try again.',
    duplicateError: 'An entry already exists for that date. Change the date or review your history.',
    saveError: 'We could not save this entry. Please try again.',
    saved: 'Entry saved successfully.',
    history: 'History',
    historyCopy: 'Saved entries in descending order by date.',
    loadingHistory: 'Loading history...',
    emptyHistory:
      'No entries have been saved yet. The form is ready for the user to log their first dose when appropriate.',
    noNotes: 'No notes recorded.',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background:
      'radial-gradient(circle at 20% 0%, rgba(45,212,191,0.15), transparent 30%), radial-gradient(circle at 80% 10%, rgba(103,232,249,0.12), transparent 28%), #061316',
    color: COLORS.text,
    fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '44px 18px 112px',
  },
  shell: {
    width: '100%',
    maxWidth: 680,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 40,
  },
  eyebrow: {
    margin: '0 0 24px',
    color: COLORS.teal,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 12px',
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: 'clamp(30px, 4vw, 34px)',
    lineHeight: 1.05,
    letterSpacing: '-0.035em',
    color: COLORS.text,
  },
  subtitle: {
    margin: 0,
    maxWidth: 680,
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 1.45,
  },
  subtitleStrong: {
    color: COLORS.text,
    fontWeight: 850,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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

  const [lang, setLang] = useState<AppLanguage>('es');
  const copy = COPY[lang];

  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TirzepatideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [dose, setDose] = useState<number>(2.5);
  const [site, setSite] = useState<InjectionSite>('abdomen_left');
  const [notes, setNotes] = useState('');

  const latestEntry = entries[0] ?? null;
  const suggestedSite = getSuggestedSite(entries);
  const nextDate = latestEntry ? addDays(latestEntry.date, 7) : null;
  const daysSinceLast = latestEntry ? getDaysSince(latestEntry.date) : null;

  useEffect(() => {
    setLang(getPreferredLanguage());
  }, []);

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
        setErrorMessage(copy.loadError);
        setEntries([]);
      } else {
        const loadedEntries = sortEntries((data ?? []) as TirzepatideEntry[]);
        setEntries(loadedEntries);

        setDate(formatDateInput(new Date()));
        setNotes('');

        if (loadedEntries.length > 0) {
          setDose(Number(loadedEntries[0].dose));
          setSite(getSuggestedSite(loadedEntries));
        } else {
          setDose(2.5);
          setSite('abdomen_left');
        }
      }

      setLoading(false);
    }

    loadEntries();

    return () => {
      isMounted = false;
    };
  }, [copy.loadError, router, supabase]);

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
          ? copy.duplicateError
          : copy.saveError,
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
    setSuccessMessage(copy.saved);
    setSaving(false);
  }

  return (
    <>
      <main style={styles.page}>
        <div style={styles.shell}>
          <header style={styles.header}>
            <p style={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 style={styles.title}>{copy.title}</h1>
            <p style={styles.subtitle}>
              <strong style={styles.subtitleStrong}>{copy.subtitleStrong}</strong>
              <br />
              {copy.subtitleLine}
            </p>
          </header>

          <section style={styles.section}>
            <div style={styles.grid}>
              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>{copy.currentDose}</p>
                  <p style={styles.statusValue}>{latestEntry ? `${Number(latestEntry.dose)} mg` : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {latestEntry ? `${copy.lastRecord}: ${formatDate(latestEntry.date, lang)}` : copy.noSavedRecords}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>{copy.daysSinceLast}</p>
                  <p style={styles.statusValue}>{daysSinceLast !== null ? daysSinceLast : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {daysSinceLast !== null ? copy.calculatedFromLast : copy.firstDosePrompt}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>{copy.nextDate}</p>
                  <p style={styles.statusValue}>{nextDate ? formatDate(nextDate, lang) : '—'}</p>
                </div>
                <p style={styles.statusHint}>
                  {nextDate ? copy.estimatedWeekly : copy.appearsAfterFirst}
                </p>
              </article>

              <article style={{ ...styles.card, ...styles.statusCard }}>
                <div>
                  <p style={styles.statusLabel}>{copy.suggestedSite}</p>
                  <p style={styles.statusValue}>{getSiteShortLabel(suggestedSite, lang)}</p>
                </div>
                <p style={styles.statusHint}>{getSiteLabel(suggestedSite, lang)}</p>
              </article>
            </div>
          </section>

          <section style={styles.section}>
            <div style={{ ...styles.card, ...styles.block }}>
              <div style={styles.blockHeader}>
                <div>
                  <h2 style={styles.blockTitle}>{copy.rotationMap}</h2>
                  <p style={styles.blockCopy}>{copy.rotationCopy}</p>
                </div>
                <span style={styles.badge}>{copy.suggested}: {getSiteShortLabel(suggestedSite, lang)}</span>
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
                      <p style={styles.rotationName}>{option.label[lang]}</p>
                      <p style={styles.rotationDescription}>
                        {option.description[lang]}
                        {isLatest ? ` · ${copy.lastSiteUsed}` : ''}
                        {isSuggested ? ` · ${copy.nextSuggested}` : ''}
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
                  <h2 style={styles.blockTitle}>{copy.newEntry}</h2>
                  <p style={styles.blockCopy}>{copy.newEntryCopy}</p>
                </div>
              </div>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>{copy.date}</span>
                  <input
                    style={styles.input}
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>{copy.dose}</span>
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
                  <span style={styles.label}>{copy.site}</span>
                  <select
                    style={styles.input}
                    value={site}
                    onChange={(event) => setSite(event.target.value as InjectionSite)}
                    required
                  >
                    {SITE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[lang]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={styles.field}>
                  <span style={styles.label}>{copy.notes}</span>
                  <textarea
                    style={styles.textarea}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={copy.notesPlaceholder}
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
                  {saving ? copy.saving : copy.saveEntry}
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
                  <h2 style={styles.blockTitle}>{copy.history}</h2>
                  <p style={styles.blockCopy}>{copy.historyCopy}</p>
                </div>
              </div>

              {loading ? (
                <div style={styles.emptyState}>{copy.loadingHistory}</div>
              ) : entries.length === 0 ? (
                <div style={styles.emptyState}>{copy.emptyHistory}</div>
              ) : (
                <div style={styles.historyList}>
                  {entries.map((entry) => (
                    <article key={entry.id} style={styles.historyItem}>
                      <div>
                        <p style={styles.historyDate}>{formatDate(entry.date, lang)}</p>
                        <p style={styles.historyMeta}>{getSiteLabel(entry.site, lang)}</p>
                      </div>

                      <div>
                        <span style={styles.historyDose}>{Number(entry.dose)} mg</span>
                      </div>

                      <p style={styles.historyNotes}>{entry.notes || copy.noNotes}</p>
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
