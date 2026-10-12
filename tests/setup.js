import { vi } from 'vitest';
// Upstream tests are kept verbatim; provide their Jest mock API in Vitest.
globalThis.jest = vi;
// Upstream full-board matches set a 120s timeout explicitly. Allow 5 minutes
// in this runner: jsdom/CPU speed differs from Jest, with identical assertions.
const upstreamEach = test.each;
test.each = (...table) => {
  const parameterized = upstreamEach.call(test, ...table);
  return (name, fn, timeout) => parameterized(name, fn,
    typeof timeout === 'number' ? Math.max(timeout, 300000) : timeout);
};
// Node 25 exposes an incomplete localStorage without --localstorage-file.
// Use an isolated browser-compatible store for each worker.
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
  setItem: (key, value) => values.set(String(key), String(value)),
  removeItem: key => values.delete(String(key)),
  clear: () => values.clear(),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} });
HTMLMediaElement.prototype.play = () => Promise.resolve();
beforeEach(() => localStorage.clear());
