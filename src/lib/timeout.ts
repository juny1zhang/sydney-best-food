/** How long a request to the backend may take, body included, before it counts as failed. */
export const REQUEST_TIMEOUT_MS = 10_000;

const timeoutError = (ms: number) => new DOMException(`No answer within ${ms} ms`, 'TimeoutError');

/** Rejects with a TimeoutError when `promise` hasn't settled within `ms`; the work itself carries on. */
export function withTimeout<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(ms)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Wraps fetch so a request that hangs (a dead phone connection, a captive portal) fails after `ms` instead of
 * never settling, while the caller's own AbortSignal still works. The two are linked by hand rather than with
 * AbortSignal.any, which older Safari doesn't have.
 */
export function fetchWithTimeout(ms = REQUEST_TIMEOUT_MS, base: typeof fetch = (input, init) => fetch(input, init)): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const caller = init?.signal ?? (input instanceof Request ? input.signal : null);
    const onCallerAbort = () => controller.abort(caller?.reason);
    if (caller?.aborted) onCallerAbort();
    else caller?.addEventListener('abort', onCallerAbort, { once: true });

    // Like AbortSignal.timeout, the deadline also covers reading the body, so the timer is left to run out after
    // a response arrives; aborting a request that has already finished does nothing.
    const timer = setTimeout(() => {
      caller?.removeEventListener('abort', onCallerAbort);
      controller.abort(timeoutError(ms));
    }, ms);

    return base(input, { ...init, signal: controller.signal }).catch((err: unknown) => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onCallerAbort);
      throw err;
    });
  };
}
