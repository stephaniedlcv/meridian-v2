import { NextRequest, NextResponse }                     from 'next/server'
import { getAdminUser, hasPermission, logAdminAction }  from '@/lib/auth/is-admin'
import { createAdminClient }                             from '@/lib/supabase/admin'
import type { LandingExperience }                        from '@/types/experience'
import { FALLBACK_CONFIG }                               from '@/types/experience'

const WRITABLE_FIELDS = [
  'hero_video_url', 'mobile_video_url', 'poster_image_url',
  'headline', 'subcopy', 'primary_cta_label', 'secondary_cta_label',
  'logo_variant_url', 'background_theme', 'overlay_opacity', 'ambient_mode',
] as const

// Detects "relation does not exist" — table migration not yet run
function isTableMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01'
    || (err.message ?? '').toLowerCase().includes('does not exist')
    || (err.message ?? '').toLowerCase().includes('relation')
}

// ── GET — list all configs ─────────────────────────────────────────
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(admin.role, 'experience.read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const db = createAdminClient() as any
    const { data, error } = await db
      .from('landing_experience')
      .select('*')
      .order('created_at', { ascending: false })

    // Table not yet created — gracefully return empty state so UI shows setup guidance
    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json({ configs: [], tableReady: false })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ configs: data ?? [], tableReady: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST — create a new draft config ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(admin.role, 'experience.write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json() as Partial<LandingExperience>
    const db   = createAdminClient() as any
    const now  = new Date().toISOString()

    const { data, error } = await db
      .from('landing_experience')
      .insert({
        is_active:           false,
        hero_video_url:      body.hero_video_url      ?? null,
        mobile_video_url:    body.mobile_video_url    ?? null,
        poster_image_url:    body.poster_image_url    ?? null,
        headline:            body.headline            ?? FALLBACK_CONFIG.headline,
        subcopy:             body.subcopy             ?? FALLBACK_CONFIG.subcopy,
        primary_cta_label:   body.primary_cta_label   ?? FALLBACK_CONFIG.primary_cta_label,
        secondary_cta_label: body.secondary_cta_label ?? FALLBACK_CONFIG.secondary_cta_label,
        logo_variant_url:    body.logo_variant_url    ?? null,
        background_theme:    body.background_theme    ?? FALLBACK_CONFIG.background_theme,
        overlay_opacity:     body.overlay_opacity     ?? FALLBACK_CONFIG.overlay_opacity,
        ambient_mode:        body.ambient_mode        ?? FALLBACK_CONFIG.ambient_mode,
        updated_at:          now,
      })
      .select()
      .single()

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(
          { error: 'The landing_experience table does not exist yet. Run the SQL migration first.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      adminUserId:  admin.userId,
      action:       'experience.created',
      resourceType: 'landing_experience',
      resourceId:   data.id,
    })

    return NextResponse.json({ config: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH — update or activate a config ───────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(admin.role, 'experience.write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json() as Partial<LandingExperience> & { id: string; activate?: boolean }
    const { id, activate } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db  = createAdminClient() as any
    const now = new Date().toISOString()

    // Deactivate all others if activating this one
    if (activate) {
      await db
        .from('landing_experience')
        .update({ is_active: false, updated_at: now })
        .neq('id', id)
    }

    // Build typed update payload from whitelisted fields only
    type LandingUpdate = {
      is_active?:            boolean
      hero_video_url?:       string | null
      mobile_video_url?:     string | null
      poster_image_url?:     string | null
      headline?:             string
      subcopy?:              string
      primary_cta_label?:    string
      secondary_cta_label?:  string
      logo_variant_url?:     string | null
      background_theme?:     string
      overlay_opacity?:      number
      ambient_mode?:         string
      updated_at?:           string
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

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(
          { error: 'The landing_experience table does not exist yet. Run the SQL migration first.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      adminUserId:  admin.userId,
      action:       activate ? 'experience.activated' : 'experience.updated',
      resourceType: 'landing_experience',
      resourceId:   id,
      metadata:     { fields: Object.keys(updates).filter(k => k !== 'updated_at') },
    })

    return NextResponse.json({ config: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE — remove a draft config (cannot delete active) ─────────
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(admin.role, 'experience.write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = createAdminClient() as any

    // Safety: never delete the active config
    const { data: existing } = await db
      .from('landing_experience')
      .select('is_active')
      .eq('id', id)
      .single()

    if (existing?.is_active) {
      return NextResponse.json({ error: 'Cannot delete the active configuration' }, { status: 409 })
    }

    const { error } = await db.from('landing_experience').delete().eq('id', id)
    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(
          { error: 'The landing_experience table does not exist yet.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      adminUserId:  admin.userId,
      action:       'experience.deleted',
      resourceType: 'landing_experience',
      resourceId:   id,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
