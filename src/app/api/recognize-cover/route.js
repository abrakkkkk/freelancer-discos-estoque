import { createHash } from 'crypto';
import { readAiImage } from '@/lib/ai-image';
import { classifyAiError, extractGeminiText, geminiGenerateUrl, getGeminiKeys, parseModelJson } from '@/lib/gemini';
import { parseRecognizedPrice } from '@/utils/priceRecognition.mjs';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

const recognitionCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const GEMINI_TIMEOUT_MS = 12000;
const VARIOUS_ARTIST_PATTERN = /^(v[aá]rios(\s+artistas)?|various(\s+artists)?|trilha\s+sonora(\s+original)?|soundtrack|ost|pantanal|salome|riacho\s+doce|roque\s+santeiro|cristiana\s+oliveira|mar[ií]lia\s+p[eê]ra|lu[ií]za\s+tom[eé]|regina\s+duarte)$/i;
const COVER_NOT_RECOGNIZED = 'Capa não reconhecida. Tente ajustar o enquadramento, melhorar a iluminação ou utilizar o OCR da lombada.';

function getImageHash(base64Data) {
  return createHash('sha256').update(base64Data).digest('hex');
}

function getCachedResult(hash) {
  const entry = recognitionCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    recognitionCache.delete(hash);
    return null;
  }
  return entry.result;
}

function setCachedResult(hash, result) {
  if (recognitionCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = recognitionCache.keys().next().value;
    recognitionCache.delete(oldestKey);
  }
  recognitionCache.set(hash, { result, timestamp: Date.now() });
}

function normalizarConfianca(valor) {
  const confianca = String(valor || '').trim().toLowerCase();
  if (['alta', 'high'].includes(confianca)) return 'alta';
  if (['media', 'média', 'medium'].includes(confianca)) return 'media';
  return 'baixa';
}

export async function POST(request) {
  try {
    const geminiKeys = getGeminiKeys();
    if (geminiKeys.length === 0) {
      return Response.json(
        { success: false, error: 'Nenhuma chave de inteligência visual (GEMINI_API_KEY) configurada no servidor.' },
        { status: 500 }
      );
    }

    const parsedImage = await readAiImage(request);
    if (!parsedImage.ok) {
      return Response.json(
        { success: false, error: parsedImage.error },
        { status: parsedImage.status }
      );
    }
    const { mimeType, base64Data } = parsedImage;

    const imageHash = getImageHash(base64Data);
    const cached = getCachedResult(imageHash);
    if (cached) {
      console.log(`[Cover Recognition] Cache hit (${imageHash}) — economia de 1 chamada API`);
      return Response.json(cached);
    }

    const systemPrompt = `Identifique artista, título, ano e preço da capa de disco (vinil/CD).
REGRAS:
1. Use memória visual ou transcreva o texto exato da capa; NUNCA invente nomes.
2. Coletânea ou trilha sonora de novela/filme = artista "Various".
3. ETIQUETA DE PREÇO: Procure por uma etiqueta adesiva padrão branca (colada na capa ou no plástico) com preço escrito à mão.
- Não existem valores quebrados ou centavos.
- Os preços SEMPRE terminam em 0 ou 5 (raramente em 5; na grande maioria das vezes terminam em 0, por exemplo: 150, 120, 100, 50, 40, 20, e raramente 45). Use esse padrão para desambiguar a caligrafia manuscrita.
- ATENÇÃO AO DÍGITO 1: à mão ele costuma ser só um traço vertical fino (às vezes com um pequeno gancho no topo) e é fácil de ignorar. Antes de responder, confira se há um traço à esquerda dos outros dígitos: "|50" é 150, "|20" é 120, "|00" é 100. Preços de três dígitos são comuns.
- Retorne apenas um preço inteiro divisível por 5 no campo "preco" (ex: "150", "120", "50", "40", "20", "45"). Se não conseguir ler um valor que termine em 0 ou 5, deixe "preco": ""; nunca arredonde nem complete dígitos. Não confunda com números de catálogo ou preços gráficos da capa.
4. Se incerto sobre a capa, deixe artista/titulo vazios e confianca "baixa".
JSON: {"artista":"","titulo":"","ano":"","preco":"","confianca":"alta|media|baixa"}`;

    let candidateText = null;
    let lastError = null;

    const geminiPayload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 250
      }
    };

    async function tryGeminiModel(model, apiKey) {
      const t0 = Date.now();
      const res = await fetch(geminiGenerateUrl(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
      });
      const data = await res.json();
      const durationMs = Date.now() - t0;

      if (!res.ok) {
        const errMsg = data.error?.message || `HTTP ${res.status}`;
        console.warn(`[Cover] ${model} falhou em ${durationMs}ms (${res.status}): ${errMsg}`);
        throw new Error(errMsg);
      }

      const text = extractGeminiText(data);
      if (!text) throw new Error('Resposta vazia');

      console.log(`[Cover Recognition] Sucesso com ${model} em ${durationMs}ms`);
      return text;
    }

    async function tryGemini() {
      let lastErr = null;

      for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            return await tryGeminiModel(model, key);
          } catch (err) {
            lastErr = err;
            console.warn(`[Cover] Falha em ${model} (key ...${key.slice(-6)}): ${err.message}`);
            const msg = (err.message || '').toLowerCase();
            if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
              console.warn(`[Cover] Cota esgotada na chave ...${key.slice(-6)}, alternando para próxima chave`);
              break;
            }
          }
        }
      }
      throw lastErr || new Error('Todos os modelos e chaves Gemini falharam');
    }

    try {
      candidateText = await tryGemini();
    } catch (err) {
      lastError = err.message;
      console.warn('[Cover] Gemini falhou em todas as tentativas:', err.message);
    }

    if (!candidateText) {
      console.error('Falha na análise visual:', lastError);
      const errorKind = classifyAiError(lastError);

      let friendlyError = `Falha na análise da capa: ${lastError || 'Serviço indisponível'}`;
      let statusCode = 502;
      if (errorKind === 'quota') {
        friendlyError = 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes e tente novamente.';
        statusCode = 429;
      } else if (errorKind === 'timeout') {
        friendlyError = 'O servidor demorou para responder. Verifique sua conexão e tente novamente.';
        statusCode = 504;
      }

      return Response.json(
        { success: false, error: friendlyError },
        { status: statusCode }
      );
    }

    let parsed = parseModelJson(candidateText);
    if (!parsed) {
      const artistaMatch = candidateText.match(/"artista"\s*:\s*"([^"]*)"/i);
      const tituloMatch = candidateText.match(/"titulo"\s*:\s*"([^"]*)"/i);
      const anoMatch = candidateText.match(/"ano"\s*:\s*"([^"]*)"/i);
      const precoMatch = candidateText.match(/"preco"\s*:\s*"?([^",}]*)"?/i);
      const confiancaMatch = candidateText.match(/"confianca"\s*:\s*"([^"]*)"/i);

      if (artistaMatch || tituloMatch) {
        parsed = {
          artista: artistaMatch ? artistaMatch[1] : '',
          titulo: tituloMatch ? tituloMatch[1] : '',
          ano: anoMatch ? anoMatch[1] : '',
          preco: precoMatch ? precoMatch[1] : '',
          confianca: confiancaMatch ? confiancaMatch[1] : 'media'
        };
      } else {
        console.warn(`[Cover] Rejeitada (sem JSON/artista/titulo). Resposta bruta: ${String(candidateText).slice(0, 300)}`);
        return Response.json({ success: false, error: COVER_NOT_RECOGNIZED });
      }
    }

    let artista = String(parsed?.artista ?? '').trim();
    const titulo = String(parsed?.titulo ?? '').trim();
    const ano = String(parsed?.ano ?? '').trim();
    const preco = parseRecognizedPrice(parsed?.preco);
    const confianca = normalizarConfianca(parsed?.confianca);

    const isRiachoDoceHallucination = /riacho\s+doce/i.test(titulo) && /elizeth\s+cardoso/i.test(artista);
    if (VARIOUS_ARTIST_PATTERN.test(artista) || isRiachoDoceHallucination) {
      artista = 'Various';
    }

    if (!artista && !titulo) {
      console.warn(`[Cover] Rejeitada (artista e titulo vazios). Confianca: ${confianca}. Resposta bruta: ${String(candidateText).slice(0, 300)}`);
      return Response.json({ success: false, error: COVER_NOT_RECOGNIZED });
    }

    const successResult = {
      success: true,
      artista,
      titulo,
      ano,
      preco,
      confianca
    };

    setCachedResult(imageHash, successResult);

    return Response.json(successResult);
  } catch (err) {
    console.error('Erro interno em /api/recognize-cover:', err);
    return Response.json(
      { success: false, error: `Erro no servidor: ${err.message}` },
      { status: 500 }
    );
  }
}
