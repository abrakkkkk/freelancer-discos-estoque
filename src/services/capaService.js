import { supabase } from '@/lib/supabase';

const BUCKET = 'capas';

export async function uploadCapaPropria(dataUrl, tipo) {
  const blob = await (await fetch(dataUrl)).blob();
  const extensao = blob.type === 'image/png' ? 'png' : 'jpg';
  const caminho = `${tipo}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error('Não foi possível enviar a foto da capa. Tente novamente.');

  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}
