import { mkdirSync, openSync, closeSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// The local Vite server can run the same API without a hosted Redis account.
// One snapshot keeps the recipe and its associated image in the same transaction.
export function createDevRepository(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const database = join(directory, 'kitchen.json');
  const lock = join(directory, 'write.lock');
  const counters = new Map();
  function load() {
    try { return JSON.parse(readFileSync(database, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { revision: 0, data: null, photos: {} };
      throw error;
    }
  }
  return {
    async read() {
      const { revision, data } = load();
      return { revision, data };
    },
    async commit(expectedRevision, data, changes = {}) {
      let handle;
      try { handle = openSync(lock, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') return false;
        throw error;
      }
      const temp = database + '.' + randomUUID() + '.tmp';
      try {
        const current = load();
        if (current.revision !== expectedRevision) return false;
        const photos = { ...current.photos };
        for (const key of changes.remove || []) delete photos[key];
        if (changes.put) photos[changes.put.key] = changes.put.data;
        writeFileSync(temp, JSON.stringify({ revision: expectedRevision + 1, data, photos }), { mode: 0o600 });
        renameSync(temp, database);
        return true;
      } finally {
        closeSync(handle);
        rmSync(temp, { force: true });
        rmSync(lock, { force: true });
      }
    },
    async photo(key) {
      const {photos} = load();
      return Object.hasOwn(photos, key) ? photos[key] : null;
    },
    async limit(key, maximum, seconds) {
      const now = Date.now();
      for (const [entry, value] of counters) if (value.expires <= now) counters.delete(entry);
      const counter = counters.get(key) || { count: 0, expires: now + seconds * 1000 };
      counters.set(key, counter);
      return ++counter.count <= maximum;
    }
  };
}
