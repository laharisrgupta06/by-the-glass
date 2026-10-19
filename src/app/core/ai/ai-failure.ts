import { HttpErrorResponse } from '@angular/common/http';

import {
  INTERPRET_ERROR_CODES,
  InterpretErrorCode,
} from './ingredient-interpretation';

/**
 * Why a request to one of our AI routes didn't work, in the terms pages need. Shared
 * by "Ask our bartender", the AI Bartender and venue-menu recipes.
 */
export type InterpretFailureCode =
  | 'busy'
  | 'quota'
  | 'rate-limited'
  | 'timeout'
  | 'misconfigured'
  | 'offline'
  | 'unavailable'
  | 'failed';

export interface InterpretFailure {
  code: InterpretFailureCode;
  /** Seconds to wait, when the server said (Retry-After). */
  retryAfter?: number;
}

const PASSED_THROUGH: InterpretErrorCode[] = [
  'busy',
  'quota',
  'rate-limited',
  'timeout',
  'misconfigured',
  'unavailable',
];

/**
 * Reads the server's error code rather than guessing from the HTTP status. A response
 * without one (status 0, or a dev-proxy error page) means our API wasn't reachable.
 */
export function toFailure(error: unknown): InterpretFailure {
  if (!(error instanceof HttpErrorResponse)) return { code: 'failed' };
  const body = error.error as { error?: unknown } | null;
  const code = INTERPRET_ERROR_CODES.find(c => c === body?.error);
  const seconds = Number(error.headers?.get('Retry-After'));
  const retryAfter = seconds > 0 ? Math.ceil(seconds) : undefined;
  if (code && PASSED_THROUGH.includes(code))
    return { code: code as InterpretFailureCode, retryAfter };
  if (code) return { code: 'failed' };
  if (error.status === 0 || error.status >= 500) return { code: 'offline' };
  return { code: 'failed' };
}
