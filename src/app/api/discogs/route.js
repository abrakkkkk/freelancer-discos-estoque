import { discogsSearchUrl, getDiscogsHeaders } from '@/lib/discogs';
import { normalizeVariousQuery } from '@/utils/stringUtils';

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 300;
const FETCH_TIMEOUT_MS = 12000;
const memoryCache = new Map();

function normalizeCatno(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function getFromCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setToCache(key, data) {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { timestamp: Date.now(), data });
}

function fetchDiscogsSearch(params, headers) {
  return fetch(discogsSearchUrl({ per_page: 15, ...params }), {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');
  const catnoParam = searchParams.get('catno');

  if (!query && !barcode && !catnoParam) {
    return Response.json({ error: 'Query parameter "q", "catno" or "barcode" is required' }, { status: 400 });
  }

  const cacheKey = `b:${barcode || ''}|c:${catnoParam || ''}|q:${query || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  }

  const headers = getDiscogsHeaders();
  if (!headers) {
    return Response.json({ error: 'Discogs credentials not configured' }, { status: 500 });
  }

  try {
    if (barcode) {
      const response = await fetchDiscogsSearch({ barcode: barcode.replace(/[^0-9A-Za-z]/g, '') }, headers);
      if (!response.ok) {
        return Response.json({ error: 'Failed to fetch from Discogs' }, { status: response.status });
      }
      const data = await response.json();
      setToCache(cacheKey, data);
      return Response.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800'
        }
      });
    }

    const cleanQ = normalizeVariousQuery(catnoParam || query);
    const normQuery = normalizeCatno(cleanQ);
    const isCatnoSearch = !!catnoParam || /\d/.test(cleanQ);

    let primaryRes = null;
    try {
      const resp = await fetchDiscogsSearch({ q: cleanQ }, headers);
      if (resp.ok) {
        primaryRes = await resp.json();
      }
    } catch (e) {
      console.warn('[Discogs] Erro na busca primária:', e.message);
    }

    let results = primaryRes?.results || [];

    if (results.length === 0 && isCatnoSearch) {
      try {
        const fbResp = await fetchDiscogsSearch({ catno: cleanQ }, headers);
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          results = fbData?.results || [];
        }
      } catch (e) {
        console.warn('[Discogs] Erro no fallback de catno:', e.message);
      }
    }

    function calcularScore(item) {
      let score = 0;
      const itemCatno = normalizeCatno(item.catno);

      const isExact = !!(itemCatno && normQuery && itemCatno === normQuery);
      if (isExact) {
        score += 2000;
      } else if (itemCatno && normQuery && (itemCatno.includes(normQuery) || normQuery.includes(itemCatno))) {
        score += 500;
      }

      if (item.country === 'Brazil') {
        score += 300;
      }

      return { score, isExact };
    }

    const scoredResults = results.map(item => {
      const { score, isExact } = calcularScore(item);
      return { ...item, _score: score, isExactMatch: isExact };
    });

    scoredResults.sort((a, b) => b._score - a._score);

    const payload = { results: scoredResults };
    setToCache(cacheKey, payload);

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Discogs Fetch Error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
