/**
 * DOM lifecycle helpers — auto-cleanup nanostore subscriptions when an element
 * leaves the document. Used by reactive views (PetView, home, etc.) to avoid
 * the subscriber-leak problem where every navigation accumulates listeners
 * against detached DOM nodes.
 *
 * onUnmount() watches document.body for childList mutations and fires `fn`
 * exactly once when `node` is no longer connected. bind() is sugar for
 * "subscribe + auto-cleanup on unmount."
 */
type Subscribable<T> = { subscribe: (fn: (v: T) => void) => () => void };

export function onUnmount(node: Node, fn: () => void): void {
  let fired = false;
  const obs = new MutationObserver(() => {
    if (fired) return;
    if (!node.isConnected) {
      fired = true;
      obs.disconnect();
      fn();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

export function bind<T>(
  node: Node,
  store: Subscribable<T>,
  fn: (v: T) => void,
): void {
  const unsub = store.subscribe(fn);
  onUnmount(node, unsub);
}
