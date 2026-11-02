import { z } from 'zod';
export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
export const fail = (error: string): Result<never> => ({ ok: false, error });
export const done = <T,>(data?: T): Result<T> => ({ ok: true, data });
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');
export function zErr(e: z.ZodError) { return e.issues.map((i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message).join('; '); }
