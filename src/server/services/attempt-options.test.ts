import { describe, expect, it } from 'vitest';

/**
 * The frozen option order, and what happens when it goes stale.
 *
 * An attempt stores its option order as ids. Editing a question in the admin
 * panel replaces its options wholesale — new rows, new ids — so every id in the
 * snapshot matches nothing and the student sees a question with no options at
 * all. That reached a live paper: questions 43, 44 and 50 of the 2011 Paper I
 * rendered as bare text with nothing to choose.
 */
interface Option {
  id: string;
  label: string;
  isCorrect: boolean;
}

/** The resolution rule as `buildAttemptState` applies it. */
function resolve(optionOrder: string[], current: Option[]): Option[] {
  const map = new Map(current.map((o) => [o.id, o]));
  const ordered = optionOrder.map((id) => map.get(id)).filter((o): o is Option => Boolean(o));
  return ordered.length > 0 ? ordered : current;
}

const CURRENT: Option[] = [
  { id: 'new-1', label: 'A', isCorrect: false },
  { id: 'new-2', label: 'B', isCorrect: true },
  { id: 'new-3', label: 'C', isCorrect: false },
];

describe('frozen option order', () => {
  it('keeps the attempt shuffle while the ids still match', () => {
    const ordered = resolve(['new-3', 'new-1', 'new-2'], CURRENT);
    expect(ordered.map((o) => o.id)).toEqual(['new-3', 'new-1', 'new-2']);
  });

  it('falls back to the question order when an edit replaced every option', () => {
    // The ids an admin's edit left behind.
    const ordered = resolve(['old-1', 'old-2', 'old-3'], CURRENT);

    expect(ordered).toHaveLength(3);
    expect(ordered.map((o) => o.id)).toEqual(['new-1', 'new-2', 'new-3']);
  });

  it('still exposes a correct answer after that fallback', () => {
    const ordered = resolve(['old-1', 'old-2'], CURRENT);
    expect(ordered.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it('keeps the options that survive a partial edit', () => {
    const ordered = resolve(['new-2', 'gone', 'new-1'], CURRENT);
    expect(ordered.map((o) => o.id)).toEqual(['new-2', 'new-1']);
  });
});
