import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type FeedbackRequestBody = {
  user_id?: unknown;
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let body: FeedbackRequestBody;

  try {
    body = (await request.json()) as FeedbackRequestBody;
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { user_id, insight_id, adherence_score, skip_reason } = body;

  if (typeof user_id !== 'string' || user_id.trim().length === 0) {
    return errorResponse('user_id is required.', 400);
  }

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

  const { data, error } = await supabase
    .from('feedback_loop')
    .insert({
      user_id: user_id.trim(),
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
