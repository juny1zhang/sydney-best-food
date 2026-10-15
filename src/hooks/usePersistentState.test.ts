import { act, renderHook } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const KEY = 'test:fruit';
const FRUITS = ['apple', 'pear', 'plum'] as const;
type Fruit = (typeof FRUITS)[number];

function useFruit() {
  return usePersistentState<Fruit>(KEY, 'apple', FRUITS);
}

describe('usePersistentState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts from the default and remembers a change across remounts', () => {
    const first = renderHook(useFruit);
    expect(first.result.current[0]).toBe('apple');
    act(() => first.result.current[1]('pear'));
    expect(first.result.current[0]).toBe('pear');
    expect(localStorage.getItem(KEY)).toBe('pear');
    first.unmount();

    expect(renderHook(useFruit).result.current[0]).toBe('pear');
  });

  it('accepts updater functions like useState', () => {
    const { result } = renderHook(useFruit);
    act(() => result.current[1]((f) => (f === 'apple' ? 'plum' : 'apple')));
    expect(result.current[0]).toBe('plum');
  });

  it('ignores a stored value that is not one of the choices', () => {
    for (const junk of ['banana', '', '"pear"', '{"fruit":"pear"}']) {
      localStorage.setItem(KEY, junk);
      const { result, unmount } = renderHook(useFruit);
      expect(result.current[0]).toBe('apple');
      // The junk is replaced by the value actually in use.
      expect(localStorage.getItem(KEY)).toBe('apple');
      unmount();
    }
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(useFruit);
    expect(result.current[0]).toBe('apple');
    act(() => result.current[1]('plum'));
    expect(result.current[0]).toBe('plum');
  });
});
