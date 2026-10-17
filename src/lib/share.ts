import type { Picks } from './plan';
import { cleanPicks, cleanWishlist } from './storage';

/** What a share link carries. */
export interface SharedPlan {
  picks: Picks;
  wishlist: string[];
}

export const SHARE_PREFIX = '#plan=';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodePlan(plan: SharedPlan): string {
  const json = JSON.stringify({ v: 1, p: plan.picks, w: plan.wishlist });
  return toBase64Url(new TextEncoder().encode(json));
}

/** Reads a plan from a URL hash like "#plan=…". Returns null for anything unusable or empty. */
export function decodePlan(hash: string): SharedPlan | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(hash.slice(SHARE_PREFIX.length)));
    const data = JSON.parse(json) as { v?: unknown; p?: unknown; w?: unknown };
    if (data.v !== 1) return null;
    const plan = { picks: cleanPicks(data.p), wishlist: cleanWishlist(data.w) };
    return Object.keys(plan.picks).length || plan.wishlist.length ? plan : null;
  } catch {
    return null;
  }
}

export function shareUrl(plan: SharedPlan, base: string): string {
  return `${base}${SHARE_PREFIX}${encodePlan(plan)}`;
}

/** Adds the shared picks to mine; where both have the same meal, the shared one wins. */
export function mergePicks(mine: Picks, theirs: Picks): Picks {
  const out: Picks = { ...mine };
  for (const [day, meals] of Object.entries(theirs)) {
    out[Number(day)] = { ...out[Number(day)], ...meals };
  }
  return out;
}

export function countPicks(picks: Picks): number {
  return Object.values(picks).reduce((n, meals) => n + Object.keys(meals).length, 0);
}
