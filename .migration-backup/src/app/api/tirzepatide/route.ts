import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type TirzepatidePayload = {
  user_id?: string;
  date?: string;
  dose?: number;
  site?: string;
  notes?: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id query parameter.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('tirzepatide_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await request.json()) as TirzepatidePayload;

    const userId = body.user_id;
    const date = body.date;
    const dose = Number(body.dose);
    const site = body.site;
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

    if (!userId || !date || !Number.isFinite(dose) || !site) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: user_id, date, dose, site.',
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('tirzepatide_entries')
      .insert({
        user_id: userId,
        date,
        dose,
        site,
        notes,
      })
      .select('*')
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;

      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      },
      { status: 500 },
    );
  }
}
