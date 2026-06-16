// Fuse pandoc-flavoured markdown onto the LaTeX grammar: pandoc markdown is
// essentially a LaTeX document where everything LaTeX would pass through
// verbatim as plain text is instead parsed as markdown. So we keep the LaTeX
// grammar as host (it isolates commands / math / environments) and mount an
// existing markdown grammar over exactly the runs LaTeX emits as pass-through
// prose, via parseMixed. No markdown is reimplemented here.
import { parseMixed } from '@lezer/common';
import type { SyntaxNodeRef } from '@lezer/common';
import type { MarkdownConfig, MarkdownParser, BlockContext, Line } from '@lezer/markdown';
import { tags as t } from '@lezer/highlight';
import { markdownLanguage } from '@codemirror/lang-markdown';

const COLON = 58; // ':'

// Pandoc fenced divs — `:::{.theorem}` opens (3+ colons), a line of 3+ colons
// closes. We mark the colon fence as a DivFence; the content between (including a
// `{.theorem}` attribute group, which the host latex grammar parses as a brace
// group) stays normal markdown/latex, so a div's internals — raw commands, math,
// nested divs — keep highlighting exactly like the surrounding document.
const FencedDiv: MarkdownConfig = {
  defineNodes: [{ name: 'DivFence', style: t.processingInstruction }],
  parseBlock: [
    {
      name: 'DivFence',
      parse(cx: BlockContext, line: Line): boolean {
        if (line.next !== COLON) return false;
        let i = line.pos;
        let n = 0;
        while (line.text.charCodeAt(i) === COLON) {
          i++;
          n++;
        }
        if (n < 3) return false;
        const from = cx.lineStart + line.pos;
        cx.addElement(cx.elt('DivFence', from, cx.lineStart + i));
        cx.nextLine();
        return true;
      },
    },
  ],
};

const markdownParser = (markdownLanguage.parser as MarkdownParser).configure([FencedDiv]);

// Node names the LaTeX grammar emits for text it passes through verbatim — the
// runs where markdown applies. Hash ("#") is added by the grammar so ATX
// headings survive into this overlay instead of becoming error nodes.
const PROSE_NODES = new Set([
  'Normal',
  'Whitespace',
  'NewLine',
  'BlankLine',
  'OpenBracket',
  'CloseBracket',
  'Tilde',
  'Ampersand',
  'Hash',
  'Underscore',
]);

// LaTeX constructs whose interior must stay LaTeX (holes in the markdown
// overlay) even though they contain Whitespace/NewLine nodes — e.g. a block
// `$$ … $$` spans NewLines that must not be punched into the markdown text.
const MATH_HOLES = new Set([
  'DollarMath',
  'InlineMath',
  'DisplayMath',
  'BracketMath',
  'ParenMath',
  'Math',
]);

function isProse(n: SyntaxNodeRef): boolean {
  if (!PROSE_NODES.has(n.name)) return false;
  for (let p = n.node.parent; p; p = p.parent) {
    if (MATH_HOLES.has(p.name)) return false;
  }
  return true;
}

// Mount the styled markdown parser over the host's pass-through prose. LaTeX
// constructs are holes, so math/commands/environments keep LaTeX highlighting
// while prose gets full markdown highlighting.
export const markdownProseWrap = parseMixed((node) =>
  node.name === 'LaTeX' ? { parser: markdownParser, overlay: isProse } : null,
);
