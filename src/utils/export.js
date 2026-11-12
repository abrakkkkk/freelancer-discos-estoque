import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function exportarEstoqueCompleto(filtroLoja = '') {
  async function fetchAll(table, select, orderBy) {
    let allData = [];
    let from = 0;
    const step = 1000;
    while (true) {
      let query = supabase
        .from(table)
        .select(select)
        .eq('deletado', false)
        .order(orderBy)
        .range(from, from + step - 1);
      
      if (filtroLoja) query = query.eq('loja', filtroLoja);
        
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return allData;
  }

  const [ discos, dvds, cds, vhs ] = await Promise.all([
    fetchAll('discos', 'caixa, artista, titulo, loja, preco, ativo, ano', 'artista'),
    fetchAll('dvds', 'caixa, titulo, loja, preco, ativo, ano', 'titulo'),
    fetchAll('cds', 'caixa, artista, titulo, loja, preco, ativo, ano', 'artista'),
    fetchAll('vhs', 'caixa, titulo, loja, preco, ativo, ano', 'titulo')
  ]);

  const formataStatus = (ativo) => ativo !== false ? 'Ativo (Em Estoque)' : 'Inativo (Saída/Vendido)';
  const formataPreco = (preco) => preco ? `R$ ${Number(preco).toFixed(2).replace('.', ',')}` : 'R$ 0,00';

  const toRow = (item, comArtista) => ({
    'Localização': item.caixa || '-',
    ...(comArtista && { 'Artista': item.artista || '-' }),
    'Título': item.titulo || '-',
    'Ano': item.ano || '-',
    'Loja': item.loja || '-',
    'Preço': formataPreco(item.preco),
    'Status': formataStatus(item.ativo)
  });

  const colunasComArtista = [{wch: 15}, {wch: 35}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];
  const colunasSemArtista = [{wch: 15}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 25}];

  const planilhas = [
    { nome: 'Discos de Vinil', itens: discos, comArtista: true },
    { nome: 'DVDs', itens: dvds, comArtista: false },
    { nome: 'CDs', itens: cds, comArtista: true },
    { nome: 'VHS', itens: vhs, comArtista: false },
  ];

  const wb = XLSX.utils.book_new();
  planilhas.forEach(({ nome, itens, comArtista }) => {
    const ws = XLSX.utils.json_to_sheet(itens.map((item) => toRow(item, comArtista)));
    ws['!cols'] = comArtista ? colunasComArtista : colunasSemArtista;
    XLSX.utils.book_append_sheet(wb, ws, nome);
  });

  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const suffix = filtroLoja ? `_${filtroLoja.replace(/\s+/g, '_')}` : '';
  XLSX.writeFile(wb, `Estoque_FreelancerDiscos${suffix}_${hoje}.xlsx`);
}
