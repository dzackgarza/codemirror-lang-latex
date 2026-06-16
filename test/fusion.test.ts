import { test, expect } from 'bun:test';
import { highlightTree, classHighlighter } from '@lezer/highlight';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { latexLanguage } from '../src/latex-language';
import { latexLinter } from '../src/linter';
import { latexCompletionSource } from '../src/completion';

const parser = latexLanguage.parser;

// The highlight classes the fused parser assigns to the first occurrence of
// `needle` (via the standard classHighlighter: tag -> "tok-..."). '' = unstyled.
function classesAt(input: string, needle: string): string {
  const pos = input.indexOf(needle);
  if (pos < 0) throw new Error(`needle not found: ${JSON.stringify(needle)}`);
  let cls = '';
  highlightTree(parser.parse(input), classHighlighter, (from, to, classes) => {
    if (from <= pos && pos < to) cls = classes;
  });
  return cls;
}

// The node-name ancestry at the first occurrence of `needle`, innermost first.
function ancestryAt(input: string, needle: string): string[] {
  const pos = input.indexOf(needle);
  const names: string[] = [];
  for (let n = parser.parse(input).resolveInner(pos, 1); n; n = n.parent) names.push(n.name);
  return names;
}

// ── Non-negotiable invariant: math stays LaTeX (a hole in the markdown overlay).
test('math regions keep LaTeX highlighting (hole preserved)', () => {
  expect(classesAt('a $\\zeta(2)$ b\n', '\\zeta')).toContain('keyword');
  expect(classesAt('$$\n\\int_0^1 x\\,dx\n$$\n', '\\int')).toContain('keyword');
});

// ── CommonMark constructs that already work.
test('headings, emphasis, strong, links are highlighted', () => {
  expect(classesAt('# Heading line\n', 'Heading')).toContain('heading');
  expect(classesAt('a *emstar* b\n', 'emstar')).toContain('emphasis');
  expect(classesAt('a **strongx** b\n', 'strongx')).toContain('strong');
  expect(classesAt('a [lt](http://theurl) b\n', 'theurl')).toContain('link');
  expect(ancestryAt('a ![imgalt](p.png) b\n', 'imgalt')).toContain('Image');
});

// ── Lists and blockquotes parse as block structures.
test('lists and blockquotes are parsed', () => {
  expect(ancestryAt('intro\n\n- bulletitem\n', 'bulletitem')).toContain('BulletList');
  expect(ancestryAt('intro\n\n1. ordereditem\n', 'ordereditem')).toContain('OrderedList');
  expect(ancestryAt('intro\n\n> quotetext\n', 'quotetext')).toContain('Blockquote');
});

// ── Inline code and strikethrough: the reference grammar marks the DELIMITERS
// (the content stays in the editor's monospace / gets the highlight style's
// line-through), so the construct is recognised and its marks are highlighted.
test('inline code is recognised and its delimiters marked', () => {
  expect(ancestryAt('a `codespan` b\n', 'codespan')).toContain('InlineCode');
  expect(classesAt('a `codespan` b\n', '`')).not.toBe('');
});

test('strikethrough is recognised and its delimiters marked', () => {
  expect(ancestryAt('a ~~strikex~~ b\n', 'strikex')).toContain('Strikethrough');
  expect(classesAt('a ~~strikex~~ b\n', '~~')).not.toBe('');
});

// ── Pandoc fenced divs: the fence line is recognised and marked.
test('fenced div fence is recognised and marked', () => {
  expect(classesAt('intro\n\n:::note\ndivcontent\n:::\n', ':::')).not.toBe('');
});

// ── Underscore emphasis (the '_' passthrough token).
test('underscore emphasis is highlighted', () => {
  expect(classesAt('a _emunder_ b\n', 'emunder')).toContain('emphasis');
});

// ── Fenced divs stand in for environments: their internals parse as full latex
// (raw commands, math) just like outside, including when nested — so a lemma in
// a proof highlights correctly.
test('fenced div internals parse as full latex, including nested divs', () => {
  const doc = ':::lemma\n\\textbf{bold} and $x^2$ here\n\n:::proof\ninner \\alpha text\n:::\n:::\n';
  expect(classesAt(doc, '\\textbf')).toContain('strong'); // latex command inside div
  expect(classesAt(doc, 'x^2')).not.toBe(''); // math inside div
  expect(classesAt(doc, '\\alpha')).toContain('keyword'); // latex inside NESTED div
});

// ── The latex linter must not false-positive on a normal pandoc-markdown
// document (no \documentclass, markdown prose, inline math) — proving the editor
// is usable for latex-in-markdown, not just pure .tex.
test('linter does not flag a normal pandoc-markdown document', () => {
  const doc =
    '# Heading\n\nProse with *emphasis*, a [link](http://u), and $\\zeta(2) = \\pi^2/6$.\n\n- item one\n- item two\n\n:::note\nA remark with $x^2$.\n:::\n';
  const state = EditorState.create({ doc, extensions: [latexLanguage] });
  const diagnostics = latexLinter({ checkMissingDocumentEnv: false })(
    { state } as never,
  );
  expect(diagnostics).toEqual([]);
});

// ── Command completion offers latex commands AND snippets (Overleaf-parity
// authoring aid), so the autocomplete feature is wired with content.
test('completion offers latex commands and snippets', () => {
  const doc = '\\beg';
  const state = EditorState.create({ doc, extensions: [latexLanguage] });
  const result = latexCompletionSource(true)(
    new CompletionContext(state, doc.length, true),
  );
  expect(result).not.toBeNull();
  const labels = (result!.options ?? []).map((o) => o.label);
  // the \begin{...} snippet is among the offered completions
  expect(labels.some((l) => l.includes('begin'))).toBe(true);
});
