const RPC_NAME = 'stock_write_transaction';

export function createStockWriteService({ rpc, invalidateCache = () => {}, notifyChange = () => {} }) {
  function notify(category, ids) {
    const validIds = ids.filter((id) => id !== undefined && id !== null);
    if (validIds.length === 0) return;
    try {
      notifyChange({ category, ids: validIds });
    } catch {
      return;
    }
  }

  async function runTransaction(parameters) {
    const { data, error } = await rpc(RPC_NAME, parameters);
    if (error) throw error;
    return data;
  }

  function invalidateCacheWhenLocationChanges(payload) {
    if (payload.caixa !== undefined || payload.loja !== undefined) {
      invalidateCache();
    }
  }

  return {
    async addItem(category, item, movement, observation = null) {
      const data = await runTransaction({
        p_action: 'create',
        p_category: category,
        p_payload: item,
        p_movement: movement,
        p_observation: observation,
      });

      if (item.caixa) invalidateCache();
      notify(category, [data?.id]);
      return data;
    },

    async bulkUpdate(category, ids, payload) {
      if (!ids || ids.length === 0) return;
      const uniqueIds = [...new Set(ids)];

      await runTransaction({
        p_action: 'bulk_update',
        p_category: category,
        p_ids: uniqueIds,
        p_payload: payload,
      });

      invalidateCacheWhenLocationChanges(payload);
      notify(category, uniqueIds);
    },

    async deleteItemWithMovement(category, item, reason = 'Saída (Excluído)') {
      await runTransaction({
        p_action: 'soft_delete',
        p_category: category,
        p_ids: [item.id],
        p_reason: reason,
      });
      notify(category, [item.id]);
    },

    async bulkDeleteWithMovement(category, items, reason = 'Saída em Lote') {
      if (!items || items.length === 0) return;

      const uniqueIds = [...new Set(items.map((item) => item.id))];
      await runTransaction({
        p_action: 'soft_delete',
        p_category: category,
        p_ids: uniqueIds,
        p_reason: reason,
      });
      notify(category, uniqueIds);
    },

    async promoteReplacement(category, replacementId, targetBox, targetStore, movement) {
      const payload = {};
      if (targetBox) payload.caixa = targetBox;
      if (targetStore) payload.loja = targetStore;

      await runTransaction({
        p_action: 'promote',
        p_category: category,
        p_item_id: replacementId,
        p_payload: payload,
        p_movement: movement,
      });

      if (targetBox || targetStore) invalidateCache();
      notify(category, [replacementId]);
    },
  };
}
