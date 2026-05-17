import { redirect }          from 'next/navigation'
import { getAdminUser }      from '@/lib/auth/is-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminShell            from './_components/AdminShell'
import './admin-responsive.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await getAdminUser()
  if (!adminUser) redirect('/dashboard')

  const admin = createAdminClient()

  const [profileRes, authRes] = await Promise.all([
    admin.from('profiles').select('display_name, full_name').eq('id', adminUser.userId).single(),
    admin.auth.admin.getUserById(adminUser.userId),
  ])

  const p = profileRes.data as { display_name: string | null; full_name: string | null } | null
  const displayName: string | null = p ? (p.display_name ?? p.full_name) : null
  const email: string | null       = authRes.data?.user?.email ?? null

  return (
    <AdminShell role={adminUser.role} displayName={displayName} email={email}>
      {children}
    </AdminShell>
  )
}
