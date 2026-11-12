const DISCOGS_SEARCH_URL = 'https://api.discogs.com/database/search';

export function getDiscogsHeaders() {
  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;
  if (!key || !secret) return null;
  return {
    Authorization: `Discogs key=${key}, secret=${secret}`,
    'User-Agent': 'FreelancerDiscos/1.0',
  };
}

export function discogsSearchUrl(params) {
  const query = Object.entries({ type: 'release', ...params })
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  return `${DISCOGS_SEARCH_URL}?${query}`;
}
