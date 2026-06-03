import { NextResponse }  from 'next/server'
import { getAdminUser } from '@/lib/auth/is-admin'

export async function GET() {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ isAdmin: false })
    }
    return NextResponse.json({ isAdmin: true, role: adminUser.role })
  } catch {
    return NextResponse.json({ isAdmin: false })
  }
}
