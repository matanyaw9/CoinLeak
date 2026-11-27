// Rule patterns that could freeze the app (review 2026-11-27): shared so core
// refuses them when a rule is saved and the editor can say why as you type.

/**
 * An open-ended repeat of a group that already repeats open-endedly, such as
 * `(\d+)+`: on a long text that does not match it can take minutes, and
 * rules run on the main process. Checked when a rule is saved, never when it
 * runs, so a rule saved before keeps working. Open-ended: `+`, `*`, `{n,}`.
 * A fixed count like `{3}` or `{2,4}` is fine. Escapes and `[...]` are text.
 */
export function hasNestedRepeat(pattern: string): boolean {
  // One entry for the whole pattern and one per open group: does it hold an open-ended repeat?
  const repeats = [false];
  let inClass = false;
  let closedRepeatingGroup = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    const afterRepeatingGroup = closedRepeatingGroup;
    closedRepeatingGroup = false;
    let openEnded = c === "+" || c === "*";
    if (c === "{" && !inClass) {
      const end = pattern.indexOf("}", i);
      const count = end === -1 ? "" : pattern.slice(i + 1, end);
      if (/^\d+(,\d*)?$/.test(count)) {
        openEnded = count.endsWith(",");
        i = end;
      }
    }
    if (c === "\\") i++;
    else if (inClass) inClass = c !== "]";
    else if (c === "[") inClass = true;
    else if (c === "(") repeats.push(false);
    else if (c === ")") {
      closedRepeatingGroup = repeats.pop() === true;
      // Then the group around it holds a repeat too.
      if (closedRepeatingGroup) repeats[repeats.length - 1] = true;
    } else if (openEnded) {
      if (afterRepeatingGroup) return true;
      repeats[repeats.length - 1] = true;
    }
  }
  return false;
}
