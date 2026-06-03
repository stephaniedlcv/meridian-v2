#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()
SRC = ROOT / "src"

if not SRC.exists():
    raise SystemExit("ERROR: Run this from .migration-backup. Expected ./src to exist.")

# 1) Shared authenticated route helper
helper_path = SRC / "lib" / "supabase" / "route-auth.ts"
helper_path.parent.mkdir(parents=True, exist_ok=True)
helper_path.write_text("""import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export type AuthenticatedRouteContext = {
  supabase: ReturnType<typeof createRouteClient>;
  user: {
    id: string;
    email?: string;
  };
};

export function createRouteClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
            // Route handlers do not always need to write cookies.
          }
        },
      },
    },
  );
}

export async function getAuthenticatedRouteContext(): Promise<
  | { context: AuthenticatedRouteContext; errorResponse: null }
  | { context: null; errorResponse: NextResponse }
> {
  const supabase = createRouteClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      context: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 },
      ),
    };
  }

  return {
    context: {
      supabase,
      user: {
        id: user.id,
        email: user.email ?? undefined,
      },
    },
    errorResponse: null,
  };
}
""", encoding="utf-8")

# 2) Secure feedback POST route: ignore client user_id, use authenticated user.id
feedback_route = SRC / "app" / "api" / "feedback" / "feedback-route.ts"
feedback_route.write_text("""import { NextResponse } from 'next/server';
import { getAuthenticatedRouteContext } from '@/lib/supabase/route-auth';

type FeedbackRequestBody = {
  user_id?: unknown; // Ignored for security. Authenticated user.id is the source of truth.
  insight_id?: unknown;
  adherence_score?: unknown;
  skip_reason?: unknown;
  notes?: unknown;
};

type ErrorResponse = {
  success: false;
  error: string;
};

type SuccessResponse = {
  success: true;
  id: string;
};

function isValidAdherenceScore(value: unknown): value is 0 | 0.5 | 1 {
  return value === 0 || value === 0.5 || value === 1;
}

function errorResponse(message: string, status: number): NextResponse<ErrorResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { context, errorResponse: authError } = await getAuthenticatedRouteContext();

  if (authError || !context) {
    return authError as NextResponse<ErrorResponse>;
  }

  let body: FeedbackRequestBody;

  try {
    body = (await request.json()) as FeedbackRequestBody;
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { insight_id, adherence_score, skip_reason } = body;

  if (typeof insight_id !== 'string' || insight_id.trim().length === 0) {
    return errorResponse('insight_id is required.', 400);
  }

  if (!isValidAdherenceScore(adherence_score)) {
    return errorResponse('adherence_score must be 0, 0.5, or 1.', 400);
  }

  const normalizedSkipReason =
    typeof skip_reason === 'string' && skip_reason.trim().length > 0
      ? skip_reason.trim()
      : null;

  const { data, error } = await context.supabase
    .from('feedback_loop')
    .insert({
      user_id: context.user.id,
      insight_id: insight_id.trim(),
      adherence_score,
      skip_reason: normalizedSkipReason,
      biometric_delta: null,
      effectiveness: 'neutral',
      window_days: 7,
    })
    .select('id')
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }

  if (!data?.id) {
    return errorResponse('Feedback was inserted, but no row id was returned.', 500);
  }

  return NextResponse.json({ success: true, id: data.id });
}
""", encoding="utf-8")

# 3) Secure feedback history route: ignore query user_id, use authenticated user.id
history_route = SRC / "app" / "api" / "feedback" / "history" / "feedback-history-route.ts"
history_route.write_text("""import { NextResponse } from 'next/server';
import { getAuthenticatedRouteContext } from '@/lib/supabase/route-auth';

type ErrorResponse = {
  success: false;
  error: string;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  insight_id: string;
  adherence_score: number | null;
  skip_reason: string | null;
  biometric_delta: unknown | null;
  effectiveness: 'validated' | 'neutral' | 'failed';
  window_days: number;
  created_at: string;
};

type SuccessResponse = {
  success: true;
  feedback: FeedbackRow[];
};

function errorResponse(message: string, status: number): NextResponse<ErrorResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { context, errorResponse: authError } = await getAuthenticatedRouteContext();

  if (authError || !context) {
    return authError as NextResponse<ErrorResponse>;
  }

  const { data, error } = await context.supabase
    .from('feedback_loop')
    .select('*')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return errorResponse(error.message, 500);
  }

  return NextResponse.json({
    success: true,
    feedback: (data ?? []) as FeedbackRow[],
  });
}
""", encoding="utf-8")

print("Phase 3A complete.")
print("Created/updated:")
print("- src/lib/supabase/route-auth.ts")
print("- src/app/api/feedback/feedback-route.ts")
print("- src/app/api/feedback/history/feedback-history-route.ts")
