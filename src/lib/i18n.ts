'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env'

export type MeridianLanguage = 'en' | 'es'

export const LANGUAGE_STORAGE_KEY = 'meridian-language-v2'

const translations = {
  en: {
    'nav.home': 'Home',
    'nav.labs': 'Labs',
    'nav.protocol': 'Protocol',
    'nav.profile': 'Profile',
    'notifications.title': 'Notifications',
    'notifications.close': 'Close notifications',
    'notifications.markAllRead': 'Mark all read',
    'notifications.new': 'new',
    'notifications.loading': 'Loading…',
    'notifications.empty': 'No notifications right now',
    'notifications.viewAll': 'View all notifications',
    'notifications.justNow': 'Just now',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.labs': 'Laboratorios',
    'nav.protocol': 'Plan',
    'nav.profile': 'Perfil',
    'notifications.title': 'Notificaciones',
    'notifications.close': 'Cerrar notificaciones',
    'notifications.markAllRead': 'Marcar todas como leídas',
    'notifications.new': 'nuevas',
    'notifications.loading': 'Cargando…',
    'notifications.empty': 'No hay notificaciones ahora',
    'notifications.viewAll': 'Ver todas las notificaciones',
    'notifications.justNow': 'Ahora',
  },
} as const

export type TranslationKey = keyof typeof translations.en

let languageSupabaseClient: ReturnType<typeof createBrowserClient> | null = null

function getLanguageSupabaseClient() {
  if (!languageSupabaseClient) {
    languageSupabaseClient = createBrowserClient(
      getSupabaseUrl(),
      getSupabasePublishableKey()
    )
  }

  return languageSupabaseClient
}

function isMeridianLanguage(value: unknown): value is MeridianLanguage {
  return value === 'en' || value === 'es'
}

export function getStoredLanguage(): MeridianLanguage {
  if (typeof window === 'undefined') return 'es'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isMeridianLanguage(stored) ? stored : 'es'
}

export function setStoredLanguage(
  lang: MeridianLanguage,
  options: { dispatch?: boolean } = {}
) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)

  if (options.dispatch !== false) {
    window.dispatchEvent(new Event('meridian-language-change'))
  }
}

async function getProfileLanguage(): Promise<MeridianLanguage | null> {
  if (typeof window === 'undefined') return null

  try {
    const supabase = getLanguageSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('preferred_language load failed:', error.message)
      return null
    }

    const profileLang = (data as { preferred_language?: unknown } | null)?.preferred_language
    return isMeridianLanguage(profileLang) ? profileLang : null
  } catch (error) {
    console.warn('preferred_language load failed:', error)
    return null
  }
}

export async function persistProfileLanguage(lang: MeridianLanguage): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const supabase = getLanguageSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const payload = { id: user.id, preferred_language: lang } as Record<string, unknown>

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.warn('preferred_language save failed:', error.message)
    }
  } catch (error) {
    console.warn('preferred_language save failed:', error)
  }
}

export function useMeridianLanguage(): [MeridianLanguage, (lang: MeridianLanguage) => void] {
  const [lang, setLang] = useState<MeridianLanguage>(() => getStoredLanguage())

  useEffect(() => {
    let isMounted = true

    const applyLocalLanguage = () => {
      if (!isMounted) return
      setLang(getStoredLanguage())
    }

    applyLocalLanguage()

    getProfileLanguage().then((profileLang) => {
      if (!isMounted || !profileLang) return

      setStoredLanguage(profileLang)
      setLang(profileLang)
    })

    window.addEventListener('meridian-language-change', applyLocalLanguage)
    window.addEventListener('storage', applyLocalLanguage)

    return () => {
      isMounted = false
      window.removeEventListener('meridian-language-change', applyLocalLanguage)
      window.removeEventListener('storage', applyLocalLanguage)
    }
  }, [])

  function updateLanguage(nextLang: MeridianLanguage) {
    setStoredLanguage(nextLang)
    setLang(nextLang)
    void persistProfileLanguage(nextLang)
  }

  return [lang, updateLanguage]
}

export function t(lang: MeridianLanguage, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key
}
