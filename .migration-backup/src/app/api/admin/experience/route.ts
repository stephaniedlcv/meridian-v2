import { NextRequest, NextResponse }                     from 'next/server'
import { getAdminUser, hasPermission, logAdminAction }  from '@/lib/auth/is-admin'
import { createAdminClient }                             from '@/lib/supabase/admin'
import type { LandingExperience }                        from '@/types/experience'

const WRITABLE_FIELDS = [
  'hero_video_url', 'mobile_video_url', 'poster_image_url',
  'headline', 'subcopy', 'primary_cta_label', 'secondary_cta_label',
  'logo_variant_url', 'background_theme', 'overlay_opacity', 'ambient_mode',
] as const

// ── GET — list all configs ─────────────────────────────────────────
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'experience.read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('landing_experience')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data ?? [] })
}

// ── POST — create a new draft config ──────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'experience.write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json() as Partial<LandingExperience>
  const db   = createAdminClient()
  const now  = new Date().toISOString()

  const { data, error } = await db
    .from('landing_experience')
    .insert({
      is_active:           false,
      hero_video_url:      body.hero_video_url      ?? null,
      mobile_video_url:    body.mobile_video_url    ?? null,
      poster_image_url:    body.poster_image_url    ?? null,
      headline:            body.headline            ?? 'Meridian',
      subcopy:             body.subcopy             ?? 'Biological Intelligence System',
      primary_cta_label:   body.primary_cta_label   ?? 'Get Started',
      secondary_cta_label: body.secondary_cta_label ?? 'Log In',
      logo_variant_url:    body.logo_variant_url    ?? null,
      background_theme:    body.background_theme    ?? 'deep_teal',
      overlay_opacity:     body.overlay_opacity     ?? 0.35,
      ambient_mode:        body.ambient_mode        ?? 'standard',
      updated_at:          now,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    adminUserId:  admin.userId,
    action:       'experience.created',
    resourceType: 'landing_experience',
    resourceId:   data.id,
  })

  return NextResponse.json({ config: data })
}

// ── PATCH — update or activate a config ───────────────────────────
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'experience.write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json() as Partial<LandingExperience> & { id: string; activate?: boolean }
  const { id, activate } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db  = createAdminClient()
  const now = new Date().toISOString()

  // If activating this config, deactivate all others first
  if (activate) {
    await db
      .from('landing_experience')
      .update({ is_active: false, updated_at: now })
      .neq('id', id)
  }

  // Build the update payload from whitelisted writable fields only
  type LandingUpdate = {
    is_active?:            boolean;
    hero_video_url?:       string | null;
    mobile_video_url?:     string | null;
    poster_image_url?:     string | null;
    headline?:             string;
    subcopy?:              string;
    primary_cta_label?:    string;
    secondary_cta_label?:  string;
    logo_variant_url?:     string | null;
    background_theme?:     string;
    overlay_opacity?:      number;
    ambient_mode?:         string;
    updated_at?:           string;
  }
  const updates: LandingUpdate = { updated_at: now }
  for (const key of WRITABLE_FIELDS) {
    if (key in body) (updates as Record<string, unknown>)[key] = (body as Record<string, unknown>)[key]
  }
  if (activate) updates.is_active = true

  const { data, error } = await db
    .from('landing_experience')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    adminUserId:  admin.userId,
    action:       activate ? 'experience.activated' : 'experience.updated',
    resourceType: 'landing_experience',
    resourceId:   id,
    metadata:     { fields: Object.keys(updates).filter(k => k !== 'updated_at') },
  })

  return NextResponse.json({ config: data })
}

// ── DELETE — remove a draft config (cannot delete active) ─────────
export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(admin.role, 'experience.write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = createAdminClient()

  // Safety: prevent deleting the active config
  const { data: existing } = await db
    .from('landing_experience')
    .select('is_active')
    .eq('id', id)
    .single()

  if (existing?.is_active) {
    return NextResponse.json({ error: 'Cannot delete the active configuration' }, { status: 409 })
  }

  const { error } = await db.from('landing_experience').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    adminUserId:  admin.userId,
    action:       'experience.deleted',
    resourceType: 'landing_experience',
    resourceId:   id,
  })

  return NextResponse.json({ ok: true })
}
