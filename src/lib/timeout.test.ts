import { REQUEST_TIMEOUT_MS, fetchWithTimeout, withTimeout } from './timeout';

/** A fetch that only ever settles when its signal aborts, or when `answer` is called. */
function slowFetch() {
  let answer: (res: Response) => void = () => {};
  const base = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        answer = resolve;
        const signal = init?.signal;
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
  );
  return { base, answer: (res: Response) => answer(res) };
}

/** Records how a promise settles without letting a rejection go unhandled. */
function track<T>(promise: Promise<T>) {
  const out: { value?: T; error?: unknown; settled: boolean } = { settled: false };
  promise.then(
    (value) => Object.assign(out, { value, settled: true }),
    (error: unknown) => Object.assign(out, { error, settled: true }),
  );
  return out;
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up on a request that never answers', async () => {
    const { base } = slowFetch();
    const res = track(fetchWithTimeout(undefined, base)('https://example.test/rest'));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(res.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(res.error).toMatchObject({ name: 'TimeoutError' });
  });

  it('passes an answer through, along with the request options', async () => {
    const { base, answer } = slowFetch();
    const ok = new Response('[]');
    const res = track(fetchWithTimeout(1000, base)('https://example.test/rest', { method: 'POST', headers: { apikey: 'k' } }));
    expect(base).toHaveBeenCalledWith('https://example.test/rest', expect.objectContaining({ method: 'POST', headers: { apikey: 'k' } }));
    answer(ok);
    await vi.advanceTimersByTimeAsync(0);
    expect(res.value).toBe(ok);
    // The timer running out later must not break anything.
    await vi.advanceTimersByTimeAsync(1000);
    expect(res.value).toBe(ok);
  });

  it("still lets the caller cancel, with the caller's reason", async () => {
    const { base } = slowFetch();
    const caller = new AbortController();
    const res = track(fetchWithTimeout(1000, base)('https://example.test/rest', { signal: caller.signal }));
    const reason = new DOMException('left the page', 'AbortError');
    caller.abort(reason);
    await vi.advanceTimersByTimeAsync(0);
    expect(res.error).toBe(reason);
  });

  it('fails at once when the caller has already given up', async () => {
    const { base } = slowFetch();
    const caller = new AbortController();
    caller.abort();
    const res = track(fetchWithTimeout(1000, base)('https://example.test/rest', { signal: caller.signal }));
    await vi.advanceTimersByTimeAsync(0);
    expect(res.error).toMatchObject({ name: 'AbortError' });
  });

  it('works in browsers without AbortSignal.any', async () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
    try {
      const { base } = slowFetch();
      const timedOut = track(fetchWithTimeout(1000, base)('https://example.test/a'));
      const caller = new AbortController();
      const cancelled = track(fetchWithTimeout(1000, base)('https://example.test/b', { signal: caller.signal }));
      caller.abort();
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedOut.error).toMatchObject({ name: 'TimeoutError' });
      expect(cancelled.error).toMatchObject({ name: 'AbortError' });
    } finally {
      if (any) Object.defineProperty(AbortSignal, 'any', any);
      else delete (AbortSignal as { any?: unknown }).any;
    }
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails work that takes too long and passes through work that does not', async () => {
    const stalled = track(withTimeout(new Promise(() => {}), 500));
    const quick = track(withTimeout(Promise.resolve('ok'), 500));
    await vi.advanceTimersByTimeAsync(0);
    expect(quick.value).toBe('ok');
    expect(stalled.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(stalled.error).toMatchObject({ name: 'TimeoutError' });
  });
});
