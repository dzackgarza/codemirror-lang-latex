import { test, expect } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { insertBracket } from '@codemirror/autocomplete';
import { latex, mathInsertBracket } from '../src/index';

// Auto-close proof burden for pandoc math delimiters: `$…$` (inline),
// `$$…$$` (display), `\(…\)`, `\[…\]`. None of these auto-close under the stock
// single-character `closeBrackets` (the reported bug), so this whole class was
// previously untested.
//
// The faithful reproduction is the editor's real input-decision chain. When a
// character is typed, the editor tries the math handler, then the stock
// close-bracket handler, then falls back to inserting the character verbatim —
// exactly what `latex()` wires (`mathCloseBrackets` before `closeBrackets()`).
// `typeChar` replays that chain over a real `latex()` state and reports the
// resulting document text and cursor, i.e. what the user would see on screen.

function typeChar(
  doc: string,
  cursor: number,
  ch: string,
): { doc: string; cursor: number } {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [latex()],
  });
  const tr = mathInsertBracket(state, ch) ?? insertBracket(state, ch);
  const next = tr
    ? tr.state
    : state.update(state.replaceSelection(ch)).state;
  return { doc: next.doc.toString(), cursor: next.selection.main.head };
}

// ── Inline `$…$`: typing `$` on an empty line closes the pair, cursor between.
test('typing $ auto-closes inline math', () => {
  expect(typeChar('', 0, '$')).toEqual({ doc: '$$', cursor: 1 });
});

// ── Display `$$…$$`: with the cursor already inside a `$|$` pair (the state
// left by the inline close), typing `$` promotes it to a display pair.
test('typing $ inside $|$ auto-closes display math', () => {
  expect(typeChar('$$', 1, '$')).toEqual({ doc: '$$$$', cursor: 2 });
});

// ── `\(…\)`: typing `(` right after a backslash closes with `\)`, not `)`.
test('typing ( after a backslash auto-closes \\(\\)', () => {
  expect(typeChar('\\', 1, '(')).toEqual({ doc: '\\(\\)', cursor: 2 });
});

// ── `\[…\]`: typing `[` right after a backslash closes with `\]`, not `]`.
test('typing [ after a backslash auto-closes \\[\\]', () => {
  expect(typeChar('\\', 1, '[')).toEqual({ doc: '\\[\\]', cursor: 2 });
});

// ── Guard: a plain `(` outside math must still close to `()` via the stock
// handler — the math handler must defer, not steal every bracket.
test('a plain ( outside math still auto-closes to ()', () => {
  expect(typeChar('', 0, '(')).toEqual({ doc: '()', cursor: 1 });
});
