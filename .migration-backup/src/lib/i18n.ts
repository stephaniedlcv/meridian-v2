'use client'

import { useEffect, useState } from 'react'

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

export function getStoredLanguage(): MeridianLanguage {
  if (typeof window === 'undefined') return 'es'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'es' || stored === 'en' ? stored : 'es'
}

export function setStoredLanguage(lang: MeridianLanguage) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  window.dispatchEvent(new Event('meridian-language-change'))
}

export function useMeridianLanguage(): [MeridianLanguage, (lang: MeridianLanguage) => void] {
  const [lang, setLang] = useState<MeridianLanguage>('es')

  useEffect(() => {
    setLang(getStoredLanguage())

    const handler = () => setLang(getStoredLanguage())
    window.addEventListener('meridian-language-change', handler)
    window.addEventListener('storage', handler)

    return () => {
      window.removeEventListener('meridian-language-change', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  function updateLanguage(nextLang: MeridianLanguage) {
    setStoredLanguage(nextLang)
    setLang(nextLang)
  }

  return [lang, updateLanguage]
}

export function t(lang: MeridianLanguage, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key
}
