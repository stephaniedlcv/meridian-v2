import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function GET(request: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId || userId.trim().length === 0) {
    return errorResponse('user_id is required.', 400);
  }

  const { data, error } = await supabase
    .from('feedback_loop')
    .select('*')
    .eq('user_id', userId.trim())
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
