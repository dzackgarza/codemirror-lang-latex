import { test, expect } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { latex } from '../src/index';
import { latexCompletionSource } from '../src/completion';
import { divFenceSnippet } from '../src/pandoc-markdown';

// Pandoc fenced divs stand in for LaTeX environments. Typing the colon fence at
// the start of a line should offer environment completions that expand to a
// `:::{.env} … :::` block — the markdown analogue of `\begin{env}` completion.

function complete(doc: string, pos: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [latex()],
  });
  const ctx = new CompletionContext(state, pos, false);
  return latexCompletionSource(true)(ctx);
}

test('typing ::: at line start offers fenced-div environments', () => {
  const r = complete(':::', 3);
  expect(r).not.toBeNull();
  expect(r!.from).toBe(0);
  const labels = r!.options.map((o) => o.label);
  expect(labels).toContain('theorem');
  expect(labels).toContain('proof');
  expect(labels).toContain('remark');
});

test('typing :: (two colons) also triggers div completion', () => {
  const r = complete('::', 2);
  expect(r).not.toBeNull();
  expect(r!.from).toBe(0);
});

// The expansion is owned, snippet-templated text: a fenced div with a tab field
// in the body and the matching close fence below.
test('a div completion expands to a :::{.env} … ::: block', () => {
  expect(divFenceSnippet('theorem')).toBe(':::{.theorem}\n${}\n:::');
});

// Guard: colons that are not at the start of a line are not a fence opener, so
// they must not trigger div completion (proves the trigger is line-anchored,
// not "any run of colons").
test('colons mid-line do not trigger div completion', () => {
  expect(complete('a::', 3)).toBeNull();
});
