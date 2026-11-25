// Keep the catalogue and its photo hash together on clustered Redis instances.
const databaseKey = '{supperclub:live:v1}';
const commitScript = `
local revision = tonumber(redis.call('HGET', KEYS[1], 'revision') or '0')
if revision ~= tonumber(ARGV[1]) then return 0 end
if ARGV[3] ~= '' then redis.call('HSET', KEYS[2], ARGV[3], ARGV[4]) end
for i=5,#ARGV do redis.call('HDEL', KEYS[2], ARGV[i]) end
redis.call('HSET', KEYS[1], 'revision', revision+1, 'data', ARGV[2])
return 1`;
const limitScript = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return hits`;

export class RedisRepository {
  constructor(url, token) {
    if (!url || !token || new URL(url).protocol !== 'https:') throw new Error('Configure a private Redis REST connection.');
    this.url = url;
    this.token = token;
  }
  async command(...parts) {
    const response = await fetch(this.url, {
      method:'POST', headers:{Authorization:'Bearer ' + this.token,'Content-Type':'application/json'},
      body:JSON.stringify(parts), signal:AbortSignal.timeout(8000), cache:'no-store'
    });
    if (!response.ok) throw new Error('Database request failed.');
    const message = await response.json();
    if (message.error) throw new Error('Database command failed.');
    return message.result;
  }
  async read() {
    const [revision, data] = await this.command('HMGET',databaseKey,'revision','data');
    return {revision:Number(revision || 0),data:data ? JSON.parse(data) : null};
  }
  async commit(expectedRevision,data,{put,remove = []} = {}) {
    const changed = await this.command('EVAL',commitScript,2,databaseKey,databaseKey + ':photos',
      expectedRevision,JSON.stringify(data),put?.key || '',put?.data || '',...remove);
    return changed === 1;
  }
  photo(key) { return this.command('HGET',databaseKey + ':photos',key); }
  async limit(key, limit, seconds) {
    const hits = await this.command('EVAL',limitScript,1,databaseKey + ':throttle:' + key,seconds);
    return hits <= limit;
  }
}
