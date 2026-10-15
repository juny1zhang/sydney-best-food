import { loadSupabase } from './supabase';

export const FEEDBACK_MAX = 1000;
export const NAME_MAX = 40;

export interface Feedback {
  message: string;
  /** Optional, so the owner knows who wrote it. */
  name: string;
  /** Where the writer was, e.g. "restaurant:lee-ho-fook" or "main". */
  page: string;
}

export type SendFeedback = (feedback: Feedback) => Promise<void>;

/** Stores feedback for the site owner to read in Supabase; visitors can write it but never read it back. */
async function insertFeedback({ message, name, page }: Feedback): Promise<void> {
  const db = await loadSupabase!();
  const { error } = await db.from('feedback').insert({
    message: message.trim().slice(0, FEEDBACK_MAX),
    name: name.trim().slice(0, NAME_MAX),
    page: page.slice(0, 100),
  });
  if (error) throw error;
}

/** Null when there is no backend to send to. */
export const sendFeedback: SendFeedback | null = loadSupabase ? insertFeedback : null;
