import { EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Auto-closing for the math delimiters pandoc markdown uses: `$…$` (inline),
// `$$…$$` (display), `\(…\)` and `\[…\]`. The stock `closeBrackets` extension
// only understands single-character pairs from a fixed list, so it cannot:
//   - close `$`/`$$` at all (they are not in its bracket list), and
//   - close `\(`→`\)` / `\[`→`\]` (two-character delimiters whose closer differs
//     from a mirrored single character — typing `(` after `\` yields `\()`).
//
// This is the math-delimiter analogue of `@codemirror/autocomplete`'s
// `insertBracket` / `closeBrackets` split: `mathInsertBracket` is the pure
// decision function (returns the transaction that performs the auto-close, or
// null to defer), and `mathCloseBrackets` is the thin input handler that
// dispatches it. The runtime tries `mathCloseBrackets` before the stock
// `closeBrackets`, so plain `(`/`[`/`{` outside math still fall through to the
// stock behavior.

/**
 * Decide the auto-close transaction for `insert` typed at the current
 * selection, or null to let the stock close-bracket handling run.
 *
 * STUB: handles nothing yet (the math delimiters are reported as not
 * auto-closing). The fix replaces this body.
 */
export function mathInsertBracket(
  _state: EditorState,
  _insert: string,
): Transaction | null {
  return null;
}

/**
 * Input handler that runs `mathInsertBracket` ahead of the stock
 * `closeBrackets`. Returns true (consuming the input) only when the resolver
 * produced a transaction; otherwise returns false so later handlers — and
 * ultimately the editor's default insertion — take over.
 */
export const mathCloseBrackets = EditorView.inputHandler.of(
  (view, from, to, insert) => {
    if (view.state.readOnly) return false;
    const sel = view.state.selection.main;
    if (from !== sel.from || to !== sel.to) return false;
    const tr = mathInsertBracket(view.state, insert);
    if (!tr) return false;
    view.dispatch(tr);
    return true;
  },
);
