'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Legacy route — History is now an internal view inside Labs.
// Redirect to /labs/upload?view=history so bookmarks and existing links keep working.
export default function LabsHistoryRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/labs/upload?view=history')
  }, [router])
  return null
}
