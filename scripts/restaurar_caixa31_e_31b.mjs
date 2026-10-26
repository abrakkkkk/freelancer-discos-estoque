import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function restaurar() {
  console.log('1. Localizando movimentações de exclusão em lote criadas às 17:05 UTC (14:05 BRT)...');
  const { data: movs, error: movErr } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('criado_em', '2026-10-26T17:05:00.700963')
    .eq('tipo', 'saida');

  if (movErr) throw movErr;
  console.log(`Encontradas ${movs.length} movimentações de saída para estornar.`);

  const discoIds = movs.map(m => m.disco_id);

  console.log('2. Buscando dados atuais dos discos para backup de segurança...');
  const { data: discos, error: discosErr } = await supabase
    .from('discos')
    .select('*')
    .in('id', discoIds);

  if (discosErr) throw discosErr;

  // Salvar backup de segurança
  const backup = {
    data_backup: new Date().toISOString(),
    total_movimentacoes: movs.length,
    total_discos: discos.length,
    movimentacoes: movs,
    discos: discos,
  };

  const backupFile = path.join(process.cwd(), 'scripts', 'backup_restauracao_caixa31_31b_20261026.json');
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Backup salvo com sucesso em: ${backupFile}`);

  // 3. Atualizar discos para deletado: false em lotes de 50
  console.log('3. Restaurando discos (deletado: false)...');
  const tamanhoBloco = 50;
  for (let i = 0; i < discoIds.length; i += tamanhoBloco) {
    const bloco = discoIds.slice(i, i + tamanhoBloco);
    const { error: updErr } = await supabase
      .from('discos')
      .update({ deletado: false })
      .in('id', bloco);
    if (updErr) throw updErr;
  }
  console.log(`Sucesso: ${discoIds.length} discos restaurados.`);

  // 4. Remover as 240 movimentações de saída acidentais
  console.log('4. Removendo movimentações acidentais de saída...');
  const movIds = movs.map(m => m.id);
  for (let i = 0; i < movIds.length; i += tamanhoBloco) {
    const bloco = movIds.slice(i, i + tamanhoBloco);
    const { error: delMovErr } = await supabase
      .from('movimentacoes')
      .delete()
      .in('id', bloco);
    if (delMovErr) throw delMovErr;
  }
  console.log(`Sucesso: ${movIds.length} movimentações de saída acidentais removidas.`);

  // 5. Verificação pós-restauração
  console.log('\n5. Verificando estado final no banco de dados...');
  const { data: vL1 } = await supabase
    .from('discos')
    .select('id')
    .eq('loja', 'Loja 1')
    .in('caixa', ['31', 'Caixa 31'])
    .eq('deletado', false);

  const { data: vL2 } = await supabase
    .from('discos')
    .select('id')
    .eq('loja', 'Loja 2')
    .ilike('caixa', '%31b%')
    .eq('deletado', false);

  console.log(`Loja 1 Caixa 31 ativos e visíveis agora: ${vL1.length}`);
  console.log(`Loja 2 Caixa 31B ativos e visíveis agora: ${vL2.length}`);
  console.log('Restauração concluída com sucesso!');
}

restaurar().catch(err => {
  console.error('Erro na restauração:', err);
  process.exit(1);
});
