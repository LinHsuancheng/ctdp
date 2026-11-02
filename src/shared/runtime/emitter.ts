type Listener<A extends unknown[]> = (...args: A) => void;

/** A minimal typed event emitter that runs in Node and in the browser. */
export class Emitter<E extends { [K in keyof E]: unknown[] }> {
  private listeners: { [K in keyof E]?: Set<Listener<E[K]>> } = {};

  on<K extends keyof E>(name: K, listener: Listener<E[K]>): this {
    (this.listeners[name] ??= new Set()).add(listener);
    return this;
  }

  off<K extends keyof E>(name: K, listener: Listener<E[K]>): this {
    this.listeners[name]?.delete(listener);
    return this;
  }

  emit<K extends keyof E>(name: K, ...args: E[K]): boolean {
    const set = this.listeners[name];
    if (!set?.size) return false;
    for (const listener of [...set]) listener(...args);
    return true;
  }
}
