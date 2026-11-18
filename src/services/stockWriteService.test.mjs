import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStockWriteService } from './stockWriteService.mjs';

function createTestService(response = { data: { id: 42 }, error: null }) {
  const calls = [];
  let invalidationCount = 0;
  const service = createStockWriteService({
    rpc: async (...args) => {
      calls.push(args);
      return response;
    },
    invalidateCache: () => {
      invalidationCount += 1;
    },
  });

  return {
    service,
    calls,
    get invalidationCount() {
      return invalidationCount;
    },
  };
}

describe('stock write service', () => {
  it('creates an item and passes its movement and observation in the same transaction', async () => {
    const testService = createTestService();
    const { service, calls } = testService;
    const item = { titulo: 'Disco', caixa: '4', loja: 'Loja 1' };
    const movement = { tipo: 'entrada', quantidade: 1 };
    const observation = { observacao: 'Capa íntegra' };

    const result = await service.addItem('discos', item, movement, observation);

    assert.deepEqual(result, { id: 42 });
    assert.deepEqual(calls, [[
      'stock_write_transaction',
      {
        p_action: 'create',
        p_category: 'discos',
        p_payload: item,
        p_movement: movement,
        p_observation: observation,
      },
    ]]);
    assert.equal(testService.invalidationCount, 1);
  });

  it('soft-deletes an item through the transactional RPC with a reason for its exit movement', async () => {
    const { service, calls } = createTestService();

    await service.deleteItemWithMovement('cds', { id: 7 }, 'Venda');

    assert.deepEqual(calls[0], [
      'stock_write_transaction',
      {
        p_action: 'soft_delete',
        p_category: 'cds',
        p_ids: [7],
        p_reason: 'Venda',
      },
    ]);
  });

  it('deduplicates ids before requesting a bulk delete', async () => {
    const { service, calls } = createTestService();

    await service.bulkDeleteWithMovement('dvds', [{ id: 3 }, { id: 3 }, { id: 8 }]);

    assert.deepEqual(calls[0][1], {
      p_action: 'soft_delete',
      p_category: 'dvds',
      p_ids: [3, 8],
      p_reason: 'Saída em Lote',
    });
  });

  it('promotes a reserve through the transactional RPC and invalidates location cache', async () => {
    const testService = createTestService();
    const { service, calls } = testService;
    const movement = { tipo: 'entrada', quantidade: 1, observacao: 'Reposição' };

    await service.promoteReplacement('vhs', 19, 'Caixa 2B', 'Loja 2', movement);

    assert.deepEqual(calls[0][1], {
      p_action: 'promote',
      p_category: 'vhs',
      p_item_id: 19,
      p_payload: { caixa: 'Caixa 2B', loja: 'Loja 2' },
      p_movement: movement,
    });
    assert.equal(testService.invalidationCount, 1);
  });

  it('notifies the storefront with the ids changed by each write', async () => {
    const notifications = [];
    const service = createStockWriteService({
      rpc: async () => ({ data: { id: 42 }, error: null }),
      notifyChange: (change) => notifications.push(change),
    });

    await service.addItem('discos', { titulo: 'Disco' });
    await service.bulkUpdate('cds', [5, 5, 6], { preco: 10 });
    await service.deleteItemWithMovement('vhs', { id: 7 });
    await service.bulkDeleteWithMovement('dvds', [{ id: 3 }, { id: 3 }]);
    await service.promoteReplacement('discos', 19, '4', 'Loja 1', {});

    assert.deepEqual(notifications, [
      { category: 'discos', ids: [42] },
      { category: 'cds', ids: [5, 6] },
      { category: 'vhs', ids: [7] },
      { category: 'dvds', ids: [3] },
      { category: 'discos', ids: [19] },
    ]);
  });

  it('keeps the write successful when the storefront notification throws', async () => {
    const service = createStockWriteService({
      rpc: async () => ({ data: { id: 1 }, error: null }),
      notifyChange: () => { throw new Error('offline'); },
    });

    await assert.doesNotReject(service.deleteItemWithMovement('discos', { id: 1 }));
  });

  it('does not invalidate cache after a failed database transaction', async () => {
    const databaseError = new Error('transaction rejected');
    const { service, invalidationCount } = createTestService({ data: null, error: databaseError });

    await assert.rejects(service.addItem('discos', { caixa: '4' }), databaseError);
    assert.equal(invalidationCount, 0);
  });
});
