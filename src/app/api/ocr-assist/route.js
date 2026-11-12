import { readAiImage } from '@/lib/ai-image';
import { classifyAiError, extractGeminiText, geminiGenerateUrl, getGeminiKeys, parseModelJson } from '@/lib/gemini';

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash'
];

const GROQ_TIMEOUT_MS = 4000;
const GEMINI_TIMEOUT_MS = 25000;

export async function POST(request) {
  try {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const geminiKeys = getGeminiKeys();
    if (!groqKey && geminiKeys.length === 0) {
      return Response.json(
        { success: false, error: 'Nenhuma chave de IA (GROQ_API_KEY ou GEMINI_API_KEY) configurada no servidor.' },
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

    const systemPrompt = `Você é um perito fonográfico e catalogador de discos de vinil e CDs brasileiros e internacionais.
Analise a imagem deste recorte (lombada, contracapa ou selo do vinil).
Identifique e extraia estritamente o CÓDIGO DE CATÁLOGO / NÚMERO DE REFERÊNCIA FONOGRÁFICA (ex: "COLP 12225", "SMOFB 3624", "BPL 15", "OW 606", "31C 064 422894", "6349 050", "150 0006", "138.250", "XSLP 1001", "710 0680").

Retorne estritamente um JSON com este formato:
{
  "codigo": "COLP 12225",
  "confianca": "alta"
}

Regras obrigatórias:
1. Ignore palavras institucionais como "STEREO", "MONO", "LADO 1", "33 RPM", "DISCO É CULTURA", "SÉRIE LUXO", nomes de músicas, preços ou CNPJ.
2. Preserve letras do prefixo e números (ex: se estiver escrito "COLP 12225", retorne "COLP 12225").
3. Se não houver nenhum código legível na imagem, responda:
{
  "codigo": "",
  "confianca": "baixa"
}`;

    let rawText = null;
    let lastError = null;

    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extraia o código de catálogo desta imagem e responda estritamente o JSON requisitado.' },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 50,
            temperature: 0
          }),
          signal: AbortSignal.timeout(GROQ_TIMEOUT_MS)
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          rawText = groqData.choices?.[0]?.message?.content?.trim();
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          lastError = errData?.error?.message || `Groq status ${groqRes.status}`;
          console.warn('Groq OCR falhou, acionando fallback Gemini:', lastError);
        }
      } catch (errGroq) {
        lastError = errGroq.message;
        console.warn('Groq OCR indisponível, acionando fallback Gemini:', errGroq.message);
      }
    }

    if (!rawText && geminiKeys.length > 0) {
      keysLoop: for (const key of geminiKeys) {
        for (const model of GEMINI_MODELS) {
          try {
            const generationConfig = {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 50
            };

            if (model.includes('flash')) {
              generationConfig.thinkingConfig = { thinkingBudget: 0 };
            }

            const payload = {
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              generationConfig
            };

            const res = await fetch(geminiGenerateUrl(model, key), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
            });

            const data = await res.json();
            if (res.ok) {
              rawText = extractGeminiText(data);
              if (rawText) break keysLoop;
            } else {
              lastError = data.error?.message || `Erro ${res.status}`;
              console.warn(`Tentativa Gemini OCR com ${model} falhou (${res.status}): ${lastError}`);
              if (![400, 404, 503].includes(res.status)) {
                break;
              }
            }
          } catch (err) {
            lastError = err.message;
            console.warn(`Tentativa Gemini OCR com ${model} disparou exceção: ${err.message}`);
          }
        }
      }
    }

    if (!rawText) {
      const errorKind = classifyAiError(lastError);

      let friendlyError = `Não foi possível ler o código com IA: ${lastError || 'Serviço indisponível'}`;
      if (errorKind === 'quota') {
        friendlyError = 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes.';
      } else if (errorKind === 'timeout') {
        friendlyError = 'Tempo limite de leitura esgotado. Tente aproximar a câmera da lombada.';
      }

      return Response.json(
        { success: false, error: friendlyError },
        { status: 502 }
      );
    }

    let parsed = parseModelJson(rawText);
    if (!parsed) {
      const codigoMatch = rawText.match(/"codigo"\s*:\s*"([^"]*)"/i);
      const confiancaMatch = rawText.match(/"confianca"\s*:\s*"([^"]*)"/i);
      if (codigoMatch) {
        parsed = {
          codigo: codigoMatch[1],
          confianca: confiancaMatch ? confiancaMatch[1] : 'media'
        };
      } else {
        return Response.json(
          { success: false, error: 'Não foi possível isolar um código válido nesta imagem.' },
          { status: 502 }
        );
      }
    }

    const codigoLimpo = String(parsed?.codigo ?? '').trim();

    return Response.json({
      success: true,
      codigo: codigoLimpo,
      confianca: parsed?.confianca || 'media'
    });
  } catch (error) {
    console.error('Erro na rota /api/ocr-assist:', error);
    return Response.json(
      { success: false, error: 'Erro interno ao processar OCR assistido.' },
      { status: 500 }
    );
  }
}
