export function getGeminiKeys() {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_BACKUP,
  ].filter(Boolean);
  return [...new Set(raw.flatMap((value) => value.split(',').map((key) => key.trim()).filter(Boolean)))];
}

export function geminiGenerateUrl(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

export function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text).filter(Boolean).join('\n').trim();
}

export function parseModelJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const toParse = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(toParse);
  } catch {
    return null;
  }
}

export function classifyAiError(message) {
  if (typeof message !== 'string') return null;
  if (/quota|429|RESOURCE_EXHAUSTED|rate_limit/.test(message)) return 'quota';
  if (/timeout|aborted/.test(message)) return 'timeout';
  return null;
}
