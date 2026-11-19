-- Lista de faixas dos discos, mostrada no detalhe da vitrine.
-- Preenchida pelo script scripts/preencher-faixas.mjs da vitrine, a partir do Discogs.
-- Formato: {"faixas": [{"posicao": "A1", "titulo": "...", "duracao": "3:38"}], "fonte": "https://www.discogs.com/release/123", "em": "2026-11-19"}
-- {"faixas": []} marca disco já procurado e não encontrado; null é disco ainda não procurado.
-- As funções do estoque só gravam as colunas enviadas, então a coluna nova não é apagada ao editar um disco.

alter table public.discos add column if not exists faixas jsonb;

comment on column public.discos.faixas is
  'Lista de faixas (Discogs) mostrada na vitrine. null = ainda não procurado; {"faixas": []} = não encontrado.';
