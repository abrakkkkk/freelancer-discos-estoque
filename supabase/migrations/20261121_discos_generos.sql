-- Gêneros dos discos, usados no filtro do catálogo e no detalhe da vitrine.
-- Preenchidos pelo script scripts/generos-catalogo.mjs da vitrine e pelo /api/revalidar, a partir do Discogs.
--
-- generos: códigos da lista da loja (src/utils/generos.js da vitrine), o principal primeiro. Ex.: {mpb,samba}.
--          null = sem gênero (ainda não procurado ou na dúvida).
-- genero_discogs: o que o Discogs disse, para refazer a tradução sem consultar de novo.
--          Ex.: {"genres": ["Latin"], "styles": ["MPB"], "fonte": "https://www.discogs.com/release/123", "em": "2026-11-21"}
--          {"genres": [], "styles": []} marca disco procurado e não encontrado.
-- As funções do estoque só gravam as colunas enviadas, então as colunas novas não são apagadas ao editar um disco.

alter table public.discos add column if not exists generos text[];
alter table public.discos add column if not exists genero_discogs jsonb;

create index if not exists discos_generos_idx on public.discos using gin (generos);

comment on column public.discos.generos is
  'Gêneros da loja mostrados na vitrine (códigos), o principal primeiro. null = sem gênero.';
comment on column public.discos.genero_discogs is
  'Gêneros e estilos do Discogs usados para calcular generos. null = ainda não procurado.';
