export function removeAcentos(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeVariousQuery(texto) {
  if (!texto) return '';
  return texto.replace(/\b(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)\b/gi, 'Various').trim();
}

export function normalizeCaixa(caixa, loja = '') {
  if (!caixa) return '';
  const str = String(caixa).trim();
  if (!str) return '';

  // 1. Shorthand com B: "5b", "19b", "5B", "caixa 5b", "caixa 19b", "c5b", "c 19b", "caixa5b" -> "Caixa 5B", "Caixa 19B"
  const matchB = str.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  // 2. Com prefixo caixa/c mas sem B: "caixa 5", "caixa 19", "c 5", "c5"
  const matchCaixaNum = str.match(/^(?:caixa|c)\s*(\d+)$/i);
  if (matchCaixaNum) {
    const num = matchCaixaNum[1];
    if (loja === 'Loja 1') {
      return num; // No banco Loja 1 armazena número puro
    }
    if (loja === 'Loja 2') {
      return `Caixa ${num}B`;
    }
    return `Caixa ${num}`;
  }

  // 3. Se for Loja 2 e digitar apenas número puro "5", entende como "Caixa 5B"
  if (loja === 'Loja 2') {
    const matchJustNum = str.match(/^(\d+)$/);
    if (matchJustNum) {
      return `Caixa ${matchJustNum[1]}B`;
    }
  }

  return str;
}

export function formatCaixa(caixa, loja) {
  if (!caixa) return '—';
  const str = String(caixa).trim();
  if (!str) return '—';

  const matchB = str.match(/^(?:caixa\s+)?(\d+)\s*b$/i);
  if (matchB) {
    return `Caixa ${matchB[1]}B`;
  }

  if (str.toLowerCase().startsWith('caixa ')) {
    return str;
  }

  const isNumeric = !isNaN(Number(str)) && str !== '';
  if (loja === 'Loja 1' && isNumeric) {
    return `Caixa ${str}`;
  }
  return str;
}

export function cleanDiscogsString(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .replace(/\*+$/g, '')
    .replace(/\s*\(\d+\)$/g, '')
    .trim();
}

/**
 * Formata artista e título para busca otimizada no Discogs.
 * - Padroniza coletâneas/trilhas para "Various [Título]"
 * - Evita repetição em álbuns homônimos (ex: "Secos & Molhados")
 * - Remove anotações e ruídos como "(obs capa)", "(lacrado)"
 */
export function formatDiscogsQuery(artista, titulo) {
  let art = (artista || '').trim();
  let tit = (titulo || '').trim();

  // Remove anotações residuais entre parênteses do título ou artista
  tit = tit.replace(/\s*\([^)]*(?:obs|capa|lacrado|importado|edicao)[^)]*\)/gi, '').trim();
  art = art.replace(/\s*\([^)]*(?:obs|capa|lacrado|importado|edicao)[^)]*\)/gi, '').trim();

  // Normaliza variações de Vários para Various
  if (/^(v[aá]rios(\s+artistas)?|various(\s+artists)?|trilha\s+sonora(\s+original)?)$/i.test(art)) {
    art = 'Various';
  }

  if (!art && !tit) return '';
  if (!art) return tit;
  if (!tit) return art;

  // Se o álbum for homônimo (ex: Artista = Titulo), não duplica na busca
  if (art.toLowerCase() === tit.toLowerCase()) {
    return art;
  }

  // Coletânea ou trilha sonora de novela
  if (art.toLowerCase() === 'various') {
    return `Various ${tit}`;
  }

  return `${art} - ${tit}`;
}

const MUSIC_STOP_WORDS = new Set([
  // Artigos e preposições (Inglês)
  'the', 'a', 'an', 'and', 'of',
  // Artigos e preposições (Português)
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'e',
  // Espanhol
  'el', 'la', 'los', 'las', 'del', 'y',
  // Francês / Italiano
  'le', 'les', 'des', 'du', 'et',
  // Tags e ruídos musicais
  'feat', 'ft', 'featuring', 'vs', 'part'
]);

const SEARCH_NOISE = /[-–—:()/\_\\*~!?[\]+"',.;&]/g;

const ACCENT_CLASSES = {
  a: '[aáàâãäÁÀÂÃÄ]',
  e: '[eéèêëÉÈÊË]',
  i: '[iíìîïÍÌÎÏ]',
  o: '[oóòôõöÓÒÔÕÖ]',
  u: '[uúùûüÚÙÛÜ]',
  c: '[cçÇ]',
  n: '[nñÑ]',
  y: '[yýÿÝ]',
};

export function accentInsensitivePattern(palavra) {
  return [...removeAcentos(palavra)]
    .map((letra) => ACCENT_CLASSES[letra] || (/[a-z0-9]/.test(letra) ? letra : '.'))
    .join('');
}

const normalizeForMatch = (texto) => removeAcentos(texto).replace(SEARCH_NOISE, ' ').replace(/\s+/g, ' ').trim();
const escapeRegExp = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function extractSearchTokens(queryStr) {
  if (!queryStr) return { allWords: [], contentWords: [], effectiveWords: [], accentedWords: [] };

  const allWords = normalizeForMatch(queryStr).split(' ').filter(Boolean);
  const contentWords = allWords.filter(w => !MUSIC_STOP_WORDS.has(w) && w.length >= 2);
  const effectiveWords = contentWords.length > 0 ? contentWords : allWords;
  const accentedWords = queryStr
    .normalize('NFC')
    .toLowerCase()
    .replace(SEARCH_NOISE, ' ')
    .split(/\s+/)
    .filter((word) => word && word !== removeAcentos(word));

  return {
    allWords,
    contentWords,
    effectiveWords,
    accentedWords
  };
}

export function createRelevanceScorer({ allWords = [], effectiveWords = [], accentedWords = [] }, isVideo = false) {
  const wordPatterns = effectiveWords.map((word) => ({
    word,
    wholeWord: new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}($|[^a-z0-9])`),
  }));
  const fullQuery = allWords.join(' ');

  return (item) => {
    if (!item) return 0;
    let score = 0;

    const itemTitulo = removeAcentos(item.titulo || '');
    const itemArtista = isVideo ? '' : removeAcentos(item.artista || '');
    const itemCaixa = removeAcentos(item.caixa || '');
    const fullText = `${itemArtista} ${itemTitulo} ${itemCaixa}`.trim();

    if (allWords.length > 0 && allWords.every(w => fullText.includes(w))) {
      score += 100;
    }

    let matchedEffective = 0;
    wordPatterns.forEach(({ word, wholeWord }) => {
      if (!fullText.includes(word)) return;
      matchedEffective++;
      score += 30;
      if (itemArtista.includes(word)) score += wholeWord.test(itemArtista) ? 60 : 20;
      if (itemTitulo.includes(word)) score += wholeWord.test(itemTitulo) ? 50 : 20;
    });

    if (effectiveWords.length > 0 && matchedEffective === effectiveWords.length) {
      score += 50;
    }

    if (fullQuery && (normalizeForMatch(itemArtista) === fullQuery || normalizeForMatch(itemTitulo) === fullQuery)) {
      score += 80;
    }

    if (accentedWords.length > 0) {
      const originalText = `${isVideo ? '' : item.artista || ''} ${item.titulo || ''}`.normalize('NFC').toLowerCase();
      accentedWords.forEach((word) => {
        if (originalText.includes(word)) score += 25;
      });
    }

    if (item.ativo !== false) {
      score += 10;
    }

    return score;
  };
}

