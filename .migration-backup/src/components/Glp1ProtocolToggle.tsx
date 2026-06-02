'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type AppLanguage = 'es' | 'en';

const COLORS = {
  background: '#061316',
  teal: '#2DD4BF',
  cyan: '#67E8F9',
  text: '#EAFBF7',
  textSoft: '#9ACBC1',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
  inputBg: 'rgba(6,19,22,0.6)',
};

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'es';

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
    eyebrow: 'Plan protocols',
    title: 'Seguimiento GLP-1',
    copy: 'Muestra el tracker en Plan solo si forma parte de tu tratamiento actual.',
    enabled: 'Activo',
    disabled: 'Inactivo',
    saving: 'Guardando',
    savedOn: 'Activado.',
    savedOff: 'Desactivado.',
    error: 'No pudimos actualizar esta preferencia.',
  },
  en: {
    eyebrow: 'Plan protocols',
    title: 'GLP-1 tracking',
    copy: 'Shows the tracker in Plan only if it is part of your current treatment.',
    enabled: 'Active',
    disabled: 'Inactive',
    saving: 'Saving',
    savedOn: 'Enabled.',
    savedOff: 'Disabled.',
    error: 'We could not update this preference.',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

const styles: Record<string, CSSProperties> = {
  card: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 20,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    padding: 18,
    marginBottom: 10,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    margin: '0 0 7px',
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
  },
  copy: {
    margin: '5px 0 0',
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 1.45,
    maxWidth: 330,
  },
  switchButton: {
    position: 'relative',
    flex: '0 0 auto',
    width: 46,
    height: 28,
    borderRadius: 999,
    border: `1px solid ${COLORS.cardBorder}`,
    background: COLORS.inputBg,
    cursor: 'pointer',
    padding: 2,
    transition: 'all 160ms ease',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    transition: 'transform 160ms ease, background 160ms ease, box-shadow 160ms ease',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 13,
    paddingTop: 12,
    borderTop: `1px solid ${COLORS.cardBorder}`,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    borderRadius: 7,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  message: {
    margin: 0,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
  },
};

export default function Glp1ProtocolToggle() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      ),
    [],
  );

  const [lang, setLang] = useState<AppLanguage>('es');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const copy = COPY[lang];

  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      const selectedLang = getPreferredLanguage();
      setLang(selectedLang);
      setLoading(true);
      setMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/onboarding/welcome');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('glp1_protocol_enabled')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;

      if (!error) {
        setEnabled(
          Boolean((data as { glp1_protocol_enabled?: boolean } | null)?.glp1_protocol_enabled),
        );
      }

      setLoading(false);
    }

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function togglePreference() {
    if (saving || loading) return;

    setSaving(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/onboarding/welcome');
      return;
    }

    const nextValue = !enabled;

    const { error } = await supabase
      .from('profiles')
      .update({ glp1_protocol_enabled: nextValue })
      .eq('id', user.id);

    if (error) {
      setMessage(copy.error);
    } else {
      setEnabled(nextValue);
      setMessage(nextValue ? copy.savedOn : copy.savedOff);
    }

    setSaving(false);
  }

  const statusText = saving ? copy.saving : enabled ? copy.enabled : copy.disabled;

  return (
    <section style={styles.card}>
      <div style={styles.row}>
        <div>
          <p style={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 style={styles.title}>{copy.title}</h2>
          <p style={styles.copy}>{copy.copy}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={copy.title}
          disabled={saving || loading}
          style={{
            ...styles.switchButton,
            opacity: saving || loading ? 0.62 : 1,
            background: enabled ? 'rgba(45,212,191,0.13)' : COLORS.inputBg,
            borderColor: enabled ? 'rgba(45,212,191,0.28)' : COLORS.cardBorder,
          }}
          onClick={togglePreference}
        >
          <span
            style={{
              ...styles.knob,
              display: 'block',
              transform: enabled ? 'translateX(18px)' : 'translateX(0)',
              background: enabled ? COLORS.teal : 'rgba(95,142,133,0.82)',
              boxShadow: enabled ? '0 0 10px rgba(45,212,191,0.25)' : 'none',
            }}
          />
        </button>
      </div>

      <div style={styles.footer}>
        <span
          style={{
            ...styles.statusPill,
            color: enabled ? COLORS.teal : COLORS.textMuted,
            background: enabled ? 'rgba(45,212,191,0.07)' : 'rgba(95,142,133,0.07)',
            border: enabled ? '1px solid rgba(45,212,191,0.18)' : '1px solid rgba(95,142,133,0.18)',
          }}
        >
          {statusText}
        </span>

        {message ? <p style={styles.message}>{message}</p> : null}
      </div>
    </section>
  );
}
