import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

type InjectionSite = 'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right';

type TirzepatidePayload = {
  date?: string;
  dose?: number;
  site?: InjectionSite;
  notes?: string | null;
};

type RouteClient = ReturnType<typeof createRouteClient>;

const ALLOWED_SITES: InjectionSite[] = [
  'abdomen_left',
  'abdomen_right',
  'thigh_left',
  'thigh_right',
];

const ALLOWED_DOSES = [2.5, 5, 7.5, 10, 12.5, 15];

function createRouteClient() {
  const cookieStore = cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route handlers may not always need to write cookies.
          }
        },
      },
    },
  );
}

function isAllowedDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isAllowedDose(value: unknown): value is number {
  const dose = Number(value);
  return Number.isFinite(dose) && ALLOWED_DOSES.includes(dose);
}

function isAllowedSite(value: unknown): value is InjectionSite {
  return typeof value === 'string' && ALLOWED_SITES.includes(value as InjectionSite);
}

async function getAuthenticatedContext() {
  const supabase = createRouteClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 },
      ),
    };
  }

  return { supabase, user, errorResponse: null };
}

async function getProtocolEnabled(supabase: RouteClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('glp1_protocol_enabled')
    .eq('id', userId)
    .single();

  if (error) {
    return {
      enabled: false,
      error,
    };
  }

  return {
    enabled: Boolean(
      (data as { glp1_protocol_enabled?: boolean } | null)?.glp1_protocol_enabled,
    ),
    error: null,
  };
}

export async function GET() {
  const { supabase, user, errorResponse } = await getAuthenticatedContext();

  if (errorResponse || !user) {
    return errorResponse;
  }

  const { enabled, error: profileError } = await getProtocolEnabled(supabase, user.id);

  if (profileError) {
    return NextResponse.json(
      { success: false, error: profileError.message },
      { status: 500 },
    );
  }

  if (!enabled) {
    return NextResponse.json({
      success: true,
      protocol_enabled: false,
      data: [],
    });
  }

  const { data, error } = await supabase
    .from('tirzepatide_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    protocol_enabled: true,
    data: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user, errorResponse } = await getAuthenticatedContext();

  if (errorResponse || !user) {
    return errorResponse;
  }

  const { enabled, error: profileError } = await getProtocolEnabled(supabase, user.id);

  if (profileError) {
    return NextResponse.json(
      { success: false, error: profileError.message },
      { status: 500 },
    );
  }

  if (!enabled) {
    return NextResponse.json(
      {
        success: false,
        error: 'GLP-1 tracking is not enabled for this user.',
      },
      { status: 403 },
    );
  }

  const body = (await request.json()) as TirzepatidePayload;

  if (!isAllowedDate(body.date) || !isAllowedDose(body.dose) || !isAllowedSite(body.site)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request. Required fields: date, dose, site.',
      },
      { status: 400 },
    );
  }

  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

  const { data, error } = await supabase
    .from('tirzepatide_entries')
    .insert({
      user_id: user.id,
      date: body.date,
      dose: Number(body.dose),
      site: body.site,
      notes,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.code === '23505' ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true, data });
}
