// The indent of a line in a category tree (F88): one column per level above
// it, each with a thin vertical guide line, so a child is plainly a child.
// Put it first in a flex row; the row's lines join when rows have no gap.

export function TreeGuides({ depth }: { depth: number }) {
  if (depth <= 1) return null;
  return (
    <span aria-hidden className="flex shrink-0 self-stretch">
      {Array.from({ length: depth - 1 }, (_, i) => (
        <span key={i} className="flex w-6 justify-center">
          <span className="w-px bg-border" />
        </span>
      ))}
    </span>
  );
}
