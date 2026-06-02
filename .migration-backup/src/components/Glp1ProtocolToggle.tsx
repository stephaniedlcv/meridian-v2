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
};

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
    eyebrow: 'PLAN',
    title: 'Seguimiento GLP-1',
    copy:
      'Activa esta opción solo si GLP-1 o tirzepatide forma parte de tu plan actual. Si no aplica, Plan se mantiene limpio y sin tracker de inyecciones.',
    enabled: 'Activado',
    disabled: 'Desactivado',
    saving: 'Guardando...',
    savedOn: 'Seguimiento GLP-1 activado.',
    savedOff: 'Seguimiento GLP-1 desactivado.',
    error: 'No pudimos actualizar esta preferencia. Intenta nuevamente.',
  },
  en: {
    eyebrow: 'PLAN',
    title: 'GLP-1 tracking',
    copy:
      'Enable this only if GLP-1 or tirzepatide is part of your current plan. If it does not apply, Plan stays clean with no injection tracker.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    saving: 'Saving...',
    savedOn: 'GLP-1 tracking enabled.',
    savedOff: 'GLP-1 tracking disabled.',
    error: 'We could not update this preference. Please try again.',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

const styles: Record<string, CSSProperties> = {
  card: {
    border: `1px solid ${COLORS.cardBorder}`,
    background: COLORS.cardBg,
    borderRadius: 18,
    padding: 20,
    backdropFilter: 'blur(18px)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    margin: '0 0 8px',
    color: COLORS.teal,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: '"Fraunces", Georgia, serif',
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 1.1,
    letterSpacing: '-0.035em',
  },
  copy: {
    margin: '8px 0 0',
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 1.6,
  },
  switchButton: {
    position: 'relative',
    flex: '0 0 auto',
    width: 58,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${COLORS.cardBorder}`,
    background: 'rgba(6,19,22,0.62)',
    cursor: 'pointer',
    padding: 3,
  },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: COLORS.textMuted,
    transition: 'transform 160ms ease, background 160ms ease',
  },
  status: {
    margin: '14px 0 0',
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  message: {
    margin: '12px 0 0',
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 1.5,
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

      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage(COPY[selectedLang].error);
        setEnabled(false);
      } else {
        setEnabled(Boolean((data as { glp1_protocol_enabled?: boolean } | null)?.glp1_protocol_enabled));
      }

      setLoading(false);
    }

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function togglePreference() {
    if (saving || loading) {
      return;
    }

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
            opacity: saving || loading ? 0.6 : 1,
            background: enabled ? 'rgba(45,212,191,0.16)' : 'rgba(6,19,22,0.62)',
          }}
          onClick={togglePreference}
        >
          <span
            style={{
              ...styles.knob,
              display: 'block',
              transform: enabled ? 'translateX(24px)' : 'translateX(0)',
              background: enabled ? COLORS.teal : COLORS.textMuted,
            }}
          />
        </button>
      </div>

      <p style={styles.status}>
        {saving ? copy.saving : enabled ? copy.enabled : copy.disabled}
      </p>

      {message ? <p style={styles.message}>{message}</p> : null}
    </section>
  );
}
