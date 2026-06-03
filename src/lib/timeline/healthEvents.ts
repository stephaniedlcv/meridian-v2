'use client';

import { createClient } from '@/lib/supabase/client';
import type { Database, HealthEvent } from '@/types/database';

type HealthEventInsert = Database['public']['Tables']['health_events']['Insert'];
type HealthEventUpdate = Database['public']['Tables']['health_events']['Update'];

export type CreateHealthEventInput = Omit<
  HealthEventInsert,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

export type UpdateHealthEventInput = Omit<
  HealthEventUpdate,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

async function getCurrentUserId() {
  const supabase = createClient() as any;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error('You must be signed in to manage health events.');
  }

  return user.id;
}

export async function getUpcomingHealthEvents(): Promise<HealthEvent[]> {
  const supabase = createClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('health_events')
    .select('*')
    .eq('status', 'upcoming')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPastHealthEvents(): Promise<HealthEvent[]> {
  const supabase = createClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('health_events')
    .select('*')
    .or(`status.in.(completed,cancelled,needs_follow_up),starts_at.lt.${now}`)
    .order('starts_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getNextHealthEvent(): Promise<HealthEvent | null> {
  const supabase = createClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('health_events')
    .select('*')
    .eq('status', 'upcoming')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getHealthEventById(id: string): Promise<HealthEvent | null> {
  const supabase = createClient() as any;

  const { data, error } = await supabase
    .from('health_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function createHealthEvent(
  input: CreateHealthEventInput,
): Promise<HealthEvent> {
  const supabase = createClient() as any;
  const userId = await getCurrentUserId();

  const payload: HealthEventInsert = {
    ...input,
    user_id: userId,
    title: input.title?.trim() || input.specialty,
    event_type: input.event_type ?? 'appointment',
    prep_status: input.prep_status ?? 'not_started',
    status: input.status ?? 'upcoming',
    related_lab_ids: input.related_lab_ids ?? [],
  };

  const { data, error } = await supabase
    .from('health_events')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateHealthEvent(
  id: string,
  input: UpdateHealthEventInput,
): Promise<HealthEvent> {
  const supabase = createClient() as any;

  const payload: HealthEventUpdate = {
    ...input,
    title:
      typeof input.title === 'string' && input.title.trim().length > 0
        ? input.title.trim()
        : input.title,
  };

  const { data, error } = await supabase
    .from('health_events')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteHealthEvent(id: string): Promise<void> {
  const supabase = createClient() as any;

  const { error } = await supabase.from('health_events').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
