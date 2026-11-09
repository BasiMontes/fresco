import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { act, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useListEnterAnimation } from '@/components/ui/use-list-enter-animation';

type GetItemProps = ReturnType<typeof useListEnterAnimation>;

const marked = (index: number) => ({ 'data-list-enter': '', 'style': { '--enter-index': index } });

// The function only means something DURING a render, so every call happens inside the hook's callback.
function renderList(initialKeys: string[], callsPerKey = 1) {
  return renderHook(
    ({ keys }: { keys: string[] }) => {
      const getItemProps = useListEnterAnimation();
      return keys.map((key, index) => Array.from({ length: callsPerKey }, () => getItemProps(key, index)));
    },
    { initialProps: { keys: initialKeys } },
  );
}

describe('useListEnterAnimation', () => {
  test('the first render marks every key, staggered by position and capped at 8', () => {
    const { result } = renderList(['a', 'b', ...Array.from({ length: 10 }, (_, i) => `k${i}`)]);

    expect(result.current[0]).toEqual([marked(0)]);
    expect(result.current[1]).toEqual([marked(1)]);
    expect(result.current[11]).toEqual([marked(8)]);
  });

  test('a later render marks only the keys not seen before, with no stagger', () => {
    const { result, rerender } = renderList(['a', 'b']);
    rerender({ keys: ['a', 'b', 'c'] });

    expect(result.current).toEqual([[{}], [{}], [marked(0)]]);
  });

  test('asking twice for the same key in one render gives the same answer (Strict Mode renders twice)', () => {
    const { result } = renderList(['a', 'b'], 2);

    expect(result.current[0]).toEqual([marked(0), marked(0)]);
    expect(result.current[1]).toEqual([marked(1), marked(1)]);
  });

  test('a key marked in a render is remembered once that render commits, even if it was asked for twice', () => {
    const { result, rerender } = renderList(['a'], 2);
    rerender({ keys: ['a'] });

    expect(result.current).toEqual([[{}, {}]]);
  });
});

// FRESCO-1147: the shopping list calls the function from each ROW, with the function its parent created.
// Strict Mode renders each row twice, so the second call must not lose the attributes the server rendered.
function Row({ k, i, getItemProps }: { k: string, i: number, getItemProps: GetItemProps }) {
  return <li {...getItemProps(k, i)}>{k}</li>;
}

function RowsCallThemselves({ keys }: { keys: string[] }) {
  const getItemProps = useListEnterAnimation();
  return <ul>{keys.map((k, i) => <Row key={k} k={k} i={i} getItemProps={getItemProps} />)}</ul>;
}

function ParentCallsInItsMap({ keys }: { keys: string[] }) {
  const getItemProps = useListEnterAnimation();
  return <ul>{keys.map((k, i) => <li key={k} {...getItemProps(k, i)}>{k}</li>)}</ul>;
}

async function hydrationErrors(node: React.ReactElement, strict: boolean): Promise<string[]> {
  const container = document.createElement('div');
  container.innerHTML = renderToString(node);
  document.body.appendChild(container);
  const messages: string[] = [];
  const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => { messages.push(String(args[0])); });
  await act(async () => { hydrateRoot(container, strict ? <StrictMode>{node}</StrictMode> : node); });
  spy.mockRestore();
  return messages.filter(m => m.includes('hydrated but some attributes'));
}

describe('useListEnterAnimation under hydration', () => {
  const keys = ['ajo', 'cebolla', 'pera'];

  afterEach(() => { document.body.innerHTML = ''; });

  test('rows that call the function themselves hydrate without a mismatch in Strict Mode (FRESCO-1147)', async () => {
    expect(await hydrationErrors(<RowsCallThemselves keys={keys} />, true)).toEqual([]);
  });

  test('rows that call the function themselves hydrate without a mismatch outside Strict Mode', async () => {
    expect(await hydrationErrors(<RowsCallThemselves keys={keys} />, false)).toEqual([]);
  });

  test('a parent that calls the function in its own map hydrates without a mismatch in Strict Mode', async () => {
    expect(await hydrationErrors(<ParentCallsInItsMap keys={keys} />, true)).toEqual([]);
  });
});
