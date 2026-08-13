import { supabase } from './supabase';

export type AppNotificationRow = {
  id: string;
  actor_name: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
};

export async function insertAppNotification(input: {
  id?: string;
  title: string;
  body: string;
  kind: string;
  actorName?: string;
}): Promise<AppNotificationRow | null> {
  const payload: Record<string, string> = {
    actor_name: input.actorName ?? 'KBS',
    title: input.title,
    body: input.body,
    kind: input.kind,
  };
  if (input.id) payload.id = input.id;

  const { data, error } = await supabase
    .from('app_notifications')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.warn('Live notification insert failed:', error.message);
    return null;
  }
  return data as AppNotificationRow;
}
