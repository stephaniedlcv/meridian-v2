import { cookies } from 'next/headers';
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
