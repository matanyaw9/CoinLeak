// Ctrl+F (Cmd+F on Mac) jumps to the Transactions search box (spec 17, F33).
// The window frame catches the keys; the page focuses its box on the event,
// or on arrival when the request came from another page.

export const TRANSACTIONS_PATH = "/transactions";
const FIND_EVENT = "coinleak:find";
let waiting = false;

/** Asks the Transactions page to focus its search box, now or once it opens. */
export function requestFind(): void {
  waiting = true;
  window.dispatchEvent(new Event(FIND_EVENT));
}

/** True once per request: the page calls it when it opens. */
export function takeFindRequest(): boolean {
  const was = waiting;
  waiting = false;
  return was;
}

export function onFind(handler: () => void): () => void {
  const listener = () => {
    waiting = false;
    handler();
  };
  window.addEventListener(FIND_EVENT, listener);
  return () => window.removeEventListener(FIND_EVENT, listener);
}

