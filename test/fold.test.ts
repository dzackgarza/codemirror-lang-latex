import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, foldable, codeFolding } from '@codemirror/language';
import { latex } from '../src/index';

// A real pandoc-markdown document (heading, fenced divs standing in for a lemma
// and a proof, and a display-math block). Folding proof burdens are computed on
// the FULL parse with the editor's fold setup (latex() + codeFolding()).
const doc = readFileSync(new URL('./fixtures/sextic.md', import.meta.url), 'utf8');

// The fold range (in 1-based line numbers) offered on the first line that
// contains `needle`, or null when that line is not foldable.
function foldAtLineContaining(needle: string): { from: number; to: number } | null {
  const state = EditorState.create({ doc, extensions: [latex(), codeFolding()] });
  ensureSyntaxTree(state, doc.length, 10000);
  for (let i = 1; i <= state.doc.lines; i++) {
    const ln = state.doc.line(i);
    if (ln.text.includes(needle)) {
      const f = foldable(state, ln.from, ln.to);
      return f
        ? { from: state.doc.lineAt(f.from).number, to: state.doc.lineAt(f.to).number }
        : null;
    }
  }
  return null;
}

// ── Proof burden: the constructs a reader expects to fold.
test('the markdown section heading is foldable', () => {
  expect(foldAtLineContaining('# Calculations')).not.toBeNull();
});

test('a fenced div is foldable from its opening fence', () => {
  expect(foldAtLineContaining('.lemma}')).not.toBeNull();
});

test('a display-math block is foldable from its opening $$', () => {
  expect(foldAtLineContaining('$$')).not.toBeNull();
});

// ── Proof burden: ordinary prose lines must NOT be foldable (the observed bug
// put fold markers on paragraph lines like "Let …" and "where the sum …").
test('prose paragraph lines are not foldable', () => {
  expect(foldAtLineContaining('Let $C')).toBeNull();
  expect(foldAtLineContaining('where the sum')).toBeNull();
});
