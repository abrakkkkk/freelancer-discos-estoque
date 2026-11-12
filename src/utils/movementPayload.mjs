const MOVEMENT_FOREIGN_KEY_BY_CATEGORY = {
  discos: 'disco_id',
  dvds: 'dvd_id',
  cds: 'cd_id',
  vhs: 'vhs_id',
};

export function getMovementForeignKey(category) {
  const foreignKey = MOVEMENT_FOREIGN_KEY_BY_CATEGORY[category];
  if (!foreignKey) throw new Error('Categoria de estoque inválida.');
  return foreignKey;
}

export function createMovementPayload(category, itemId, type, quantity, observation) {
  const foreignKey = getMovementForeignKey(category);

  return {
    tipo: type,
    quantidade: quantity || 1,
    observacao: observation || null,
    [foreignKey]: itemId,
  };
}
