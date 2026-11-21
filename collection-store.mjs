/** Serialize changes and apply each operation to the latest stored collection. */
export function createCollectionStore({ key, normalize, storage = () => globalThis.localStorage, locks = globalThis.navigator?.locks }) {
  let current = normalize(null);
  // Stay visit-only after a storage failure: resuming writes could replace
  // permanent changes made in another tab with an unreconciled local list.
  let memoryOnly = false;
  let queue = Promise.resolve();

  function read() {
    if (!memoryOnly) {
      try {
        const raw = storage().getItem(key);
        let value = null;
        try { value = JSON.parse(raw); } catch { /* Invalid stored data uses normal defaults. */ }
        current = normalize(value);
      } catch {
        memoryOnly = true;
      }
    }
    return normalize(current);
  }

  function apply(operation) {
    const latest = read();
    const previous = JSON.stringify(latest);
    const outcome = operation(latest);
    current = normalize(outcome.items);
    const serialized = JSON.stringify(current);
    const changed = serialized !== previous;
    if (changed && !memoryOnly) {
      try { storage().setItem(key, serialized); }
      catch { memoryOnly = true; }
    }
    return { ...outcome, items: normalize(current), stored: !memoryOnly, changed };
  }

  async function withLock(operation) {
    if (memoryOnly || typeof locks?.request !== 'function') return apply(operation);
    let acquired = false;
    try {
      return await locks.request(`turbobrowser-storage:${key}`, () => {
        acquired = true;
        return apply(operation);
      });
    } catch (error) {
      if (acquired) throw error;
      // Restricted browsers retain an ordered per-page queue and fresh reads.
      return apply(operation);
    }
  }

  return {
    read,
    update(operation) {
      const pending = queue.then(() => withLock(operation));
      queue = pending.catch(() => {});
      return pending;
    },
  };
}
