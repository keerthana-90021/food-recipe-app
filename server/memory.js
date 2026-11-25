// Injected only by tests. The production API always uses Redis.
export class MemoryRepository {
  revision = 0;
  data = null;
  photos = new Map();
  attempts = new Map();
  async read() { return {revision:this.revision,data:structuredClone(this.data)}; }
  async commit(expectedRevision, data, {put,remove = []} = {}) {
    if (expectedRevision !== this.revision) return false;
    if (put) this.photos.set(put.key,put.data);
    for (const key of remove) this.photos.delete(key);
    this.data = structuredClone(data);
    this.revision += 1;
    return true;
  }
  async photo(key) { return this.photos.get(key) || null; }
  async limit(key,limit,seconds) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    const current = entry?.expiresAt > now ? entry : {hits:0,expiresAt:now + seconds * 1000};
    current.hits++;
    this.attempts.set(key,current);
    return current.hits <= limit;
  }
}
