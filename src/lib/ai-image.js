import { Buffer } from 'node:buffer';

const MAX_REQUEST_BYTES = 4_200_000;
const MAX_BASE64_CHARS = 4_000_000;
const IMAGE_TOO_LARGE = 'A imagem excede o limite permitido. Reduza a resolução e tente novamente.';
const INVALID_BODY = 'Corpo da requisição inválido.';

const IMAGE_SIGNATURES = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
};

export async function readAiImage(request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return { ok: false, status: 413, error: IMAGE_TOO_LARGE };
  }

  let rawBody;
  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: INVALID_BODY };
  }

  const chunks = [];
  let bodyBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bodyBytes += value.byteLength;
      if (bodyBytes > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: IMAGE_TOO_LARGE };
      }
      chunks.push(Buffer.from(value));
    }
    rawBody = Buffer.concat(chunks, bodyBytes).toString('utf8');
  } catch {
    return { ok: false, status: 400, error: INVALID_BODY };
  } finally {
    reader.releaseLock();
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: INVALID_BODY };
  }

  const image = body?.image;
  if (typeof image !== 'string' || image.length === 0) {
    return { ok: false, status: 400, error: 'Nenhuma imagem foi fornecida para análise.' };
  }
  if (image.length > MAX_BASE64_CHARS + 64) {
    return { ok: false, status: 413, error: IMAGE_TOO_LARGE };
  }

  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    return { ok: false, status: 400, error: 'Formato de imagem inválido. Envie JPEG, PNG ou WebP.' };
  }

  const [, mimeType, base64Data] = match;
  if (base64Data.length > MAX_BASE64_CHARS) {
    return { ok: false, status: 413, error: IMAGE_TOO_LARGE };
  }

  const bytes = Buffer.from(base64Data, 'base64');
  if (bytes.toString('base64') !== base64Data || !IMAGE_SIGNATURES[mimeType](bytes)) {
    return { ok: false, status: 400, error: 'O conteúdo da imagem não corresponde ao formato informado.' };
  }

  return { ok: true, mimeType, base64Data };
}
