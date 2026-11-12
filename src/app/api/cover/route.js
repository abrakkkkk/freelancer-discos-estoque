import fs from 'fs';
import path from 'path';
import { discogsSearchUrl, getDiscogsHeaders } from '@/lib/discogs';
import { normalizeVariousQuery } from '@/utils/stringUtils';

const COVER_FETCH_TIMEOUT_MS = 6000;
const HIT_CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400';
const MISS_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600';

const PRIMARY_CACHE_FILE = path.resolve(process.cwd(), '.cache/covers_cache.json');
const LEGACY_CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');

let initialCovers = {};
try {
  if (fs.existsSync(PRIMARY_CACHE_FILE)) {
    initialCovers = JSON.parse(fs.readFileSync(PRIMARY_CACHE_FILE, 'utf-8'));
  } else if (fs.existsSync(LEGACY_CACHE_FILE)) {
    initialCovers = JSON.parse(fs.readFileSync(LEGACY_CACHE_FILE, 'utf-8'));
  }
} catch {}

const runtimeMemoryCache = new Map(Object.entries(initialCovers || {}));

function getFromCache(key) {
  return runtimeMemoryCache.get(key) || null;
}

let saveDebounceTimer = null;
let isSavingCache = false;

function scheduleSaveCache() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return;

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(async () => {
    if (isSavingCache) {
      scheduleSaveCache();
      return;
    }
    isSavingCache = true;
    try {
      await fs.promises.mkdir(path.dirname(PRIMARY_CACHE_FILE), { recursive: true });
      const currentCacheObj = Object.fromEntries(runtimeMemoryCache);
      await fs.promises.writeFile(PRIMARY_CACHE_FILE, JSON.stringify(currentCacheObj, null, 2), 'utf-8');
    } catch {
    } finally {
      isSavingCache = false;
    }
  }, 2000);
}

function setToCache(key, payload) {
  runtimeMemoryCache.set(key, payload);
  scheduleSaveCache();
}

function deleteFromCache(key) {
  runtimeMemoryCache.delete(key);
  scheduleSaveCache();
}

function resolveCacheKeys({ id, tipo, rawQ, ano }) {
  const q = normalizeVariousQuery(rawQ);
  const cleanAno = ano && String(ano) !== 'null' ? String(ano).trim() : '';
  const rawId = id ? String(id) : '';
  return {
    q,
    cleanAno,
    qKey: `${q} ${cleanAno}`.trim().toLowerCase(),
    scopedId: rawId && tipo ? `${tipo}_${rawId}` : rawId,
    legacyId: rawId && (!tipo || tipo === 'discos') ? rawId : '',
  };
}

function cacheUnderIds(keys, payload) {
  if (keys.scopedId) setToCache(keys.scopedId, payload);
  if (keys.legacyId) setToCache(keys.legacyId, payload);
}

function cacheUnderAllKeys(keys, payload) {
  cacheUnderIds(keys, payload);
  if (keys.qKey) setToCache(keys.qKey, payload);
}

function hasImage(entry) {
  return Boolean(entry && (entry.cover || entry.thumb));
}

function cachedHit(entry, tag) {
  return Response.json(entry, { headers: { 'Cache-Control': HIT_CACHE_CONTROL, 'X-Cache': tag } });
}

function toCoverPayload(result, keys) {
  const thumb = result?.thumb || null;
  const cover = result?.cover_image || thumb;
  return { cover, thumb, q: keys.qKey, ano: keys.cleanAno };
}

async function searchReleases(params, headers) {
  try {
    const res = await fetch(discogsSearchUrl({ per_page: 5, ...params }), {
      headers,
      signal: AbortSignal.timeout(COVER_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function findWithImage(results) {
  return results.find((release) => release.cover_image || release.thumb);
}

async function searchDiscogsCover(q, ano, headers) {
  const attempts = ano ? [{ q, year: ano }, { q }] : [{ q }];
  for (const params of attempts) {
    const results = await searchReleases(params, headers);
    if (results.length > 0) return findWithImage(results) || results[0];
  }

  if (/^various\s+/i.test(q)) {
    const cleanTitle = q
      .replace(/^various\s+/i, '')
      .trim()
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*-\s*(nacional|internacional|volume\s*\d+|vol\.?\s*\d+)/gi, '')
      .replace(/:.*$/, '')
      .trim();

    if (cleanTitle.length >= 3) {
      const results = await searchReleases({ country: 'Brazil', q: cleanTitle }, headers);
      const match = results.find((release) => release.title?.toLowerCase().includes('various') && (release.cover_image || release.thumb))
        || findWithImage(results)
        || results[0];
      if (match) return match;
    }
  }

  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const refresh = searchParams.get('refresh') === 'true';
  const keys = resolveCacheKeys({
    id,
    tipo: searchParams.get('tipo') || searchParams.get('category') || '',
    rawQ: searchParams.get('q') || '',
    ano: searchParams.get('ano') || searchParams.get('year') || '',
  });
  const { q, qKey } = keys;

  if (!refresh) {
    const idLookups = [[keys.scopedId, 'HIT-ID'], [keys.legacyId, 'HIT-RAW-ID']];
    for (const [key, tag] of idLookups) {
      const cached = key ? getFromCache(key) : null;
      if (hasImage(cached) && (!cached.q || !qKey || cached.q.toLowerCase() === qKey)) {
        return cachedHit(cached, tag);
      }
    }

    const cachedByQ = qKey ? getFromCache(qKey) : null;
    if (hasImage(cachedByQ)) {
      cacheUnderIds(keys, { ...cachedByQ, q: qKey });
      return cachedHit(cachedByQ, 'HIT-Q');
    }
  }

  if (!q && !id) {
    return Response.json({ cover: null, thumb: null }, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    });
  }

  const headers = getDiscogsHeaders();
  if (!headers) {
    return Response.json({ cover: null, thumb: null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const payload = toCoverPayload(await searchDiscogsCover(q, keys.cleanAno, headers), keys);
    const found = hasImage(payload);
    if (found) cacheUnderAllKeys(keys, payload);

    return Response.json(payload, {
      headers: {
        'Cache-Control': refresh ? 'no-cache, no-store' : (found ? HIT_CACHE_CONTROL : MISS_CACHE_CONTROL),
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Discogs cover fetch error:', err);
    return Response.json({ cover: null, thumb: null }, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' },
    });
  }
}

export async function POST(request) {
  try {
    const { id, tipo = '', artista = '', titulo = '', ano = '', cover, thumb } = await request.json();
    const keys = resolveCacheKeys({ id, tipo, rawQ: `${artista || ''} ${titulo || ''}`.trim(), ano });

    if (cover || thumb) {
      const payload = { cover: cover || thumb, thumb: thumb || cover, q: keys.qKey, ano: keys.cleanAno };
      cacheUnderAllKeys(keys, payload);
      return Response.json({ success: true, ...payload });
    }

    if (!keys.q) {
      const emptyPayload = { cover: null, thumb: null, q: '' };
      cacheUnderIds(keys, emptyPayload);
      return Response.json({ success: true, ...emptyPayload });
    }

    const headers = getDiscogsHeaders();
    if (!headers) {
      return Response.json({ error: 'Credenciais Discogs não configuradas' }, { status: 500 });
    }

    const payload = toCoverPayload(await searchDiscogsCover(keys.q, keys.cleanAno, headers), keys);
    cacheUnderAllKeys(keys, payload);
    return Response.json({ success: true, ...payload });
  } catch (err) {
    console.error('Erro no POST /api/cover:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const tipo = searchParams.get('tipo') || '';
  if (id) {
    deleteFromCache(String(id));
    if (tipo) {
      deleteFromCache(`${tipo}_${id}`);
    }
  }
  return Response.json({ success: true });
}
