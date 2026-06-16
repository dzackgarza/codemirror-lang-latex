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
 * Handles only a plain cursor (no range selection). Defers (returns null) for
 * everything it does not own, so stock bracket-closing still serves `(`/`[`/`{`
 * outside math.
 */
export function mathInsertBracket(
  state: EditorState,
  insert: string,
): Transaction | null {
  const sel = state.selection.main;
  if (!sel.empty) return null;
  const pos = sel.from;

  // `$`: insert a matching `$` and sit between them. On an empty line this
  // opens inline math `$|$`; typing `$` again inside that pair applies the same
  // operation one level deeper, extending it to display math `$$|$$`.
  if (insert === '$') {
    return state.update({
      changes: { from: pos, insert: '$$' },
      selection: { anchor: pos + 1 },
      scrollIntoView: true,
      userEvent: 'input.type',
    });
  }

  // `\(` / `\[`: only when the typed bracket immediately follows a backslash,
  // so the closer is the two-character `\)` / `\]` (the stock single-char
  // handler would close with a bare `)` / `]`, yielding `\()` / `\[]`).
  if (insert === '(' || insert === '[') {
    const before = pos > 0 ? state.sliceDoc(pos - 1, pos) : '';
    if (before === '\\') {
      const close = insert === '(' ? '\\)' : '\\]';
      return state.update({
        changes: { from: pos, insert: insert + close },
        selection: { anchor: pos + 1 },
        scrollIntoView: true,
        userEvent: 'input.type',
      });
    }
  }

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
