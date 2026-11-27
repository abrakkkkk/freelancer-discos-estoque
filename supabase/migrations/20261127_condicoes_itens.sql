-- Condição física do item, marcada no adicionar/editar do estoque.
-- condicoes: códigos marcados, em qualquer combinação. Ex.: {capa_pirata,midia_arranhada}.
--            capa_pirata | capa_avariada | midia_arranhada | midia_avariada | midia_incompleta | disco_empenado (só discos). null = nenhuma condição marcada.
-- As funções do estoque só gravam as colunas enviadas, então as colunas novas não são apagadas por outras escritas.

alter table public.discos add column if not exists condicoes text[];
alter table public.cds add column if not exists condicoes text[];
alter table public.dvds add column if not exists condicoes text[];
alter table public.vhs add column if not exists condicoes text[];

comment on column public.discos.condicoes is 'Condição física marcada no estoque (capa_pirata, capa_avariada, midia_arranhada, midia_avariada, midia_incompleta, disco_empenado). null = nenhuma.';
comment on column public.cds.condicoes is 'Condição física marcada no estoque (capa_pirata, capa_avariada, midia_arranhada, midia_avariada, midia_incompleta, disco_empenado). null = nenhuma.';
comment on column public.dvds.condicoes is 'Condição física marcada no estoque (capa_pirata, capa_avariada, midia_arranhada, midia_avariada, midia_incompleta, disco_empenado). null = nenhuma.';
comment on column public.vhs.condicoes is 'Condição física marcada no estoque (capa_pirata, capa_avariada, midia_arranhada, midia_avariada, midia_incompleta, disco_empenado). null = nenhuma.';
