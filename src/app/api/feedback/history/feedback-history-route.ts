import { NextResponse } from 'next/server';
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
