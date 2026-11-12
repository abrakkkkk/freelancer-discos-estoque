export const PAGINATION = {
  ITEMS_PER_PAGE: 50,
};

export const CATEGORIES = [
  { id: 'discos', label: 'Discos', iconType: 'vinyl' },
  { id: 'dvds', label: 'DVDs', iconType: 'film' },
  { id: 'cds', label: 'CDs', iconType: 'disc' },
  { id: 'vhs', label: 'VHS', iconType: 'cassette' },
];

export const CATEGORY_IDS = {
  DISCOS: 'discos',
  DVDS: 'dvds',
  CDS: 'cds',
  VHS: 'vhs',
};

// capa_url vazia ('') marca item cadastrado sem capa: mostra o ícone e não busca no Discogs.
// capa_url null (itens antigos) mantém a busca automática.
export const SEM_CAPA = '';

export const STORE_OPTIONS = [
  { value: 'Loja 1', label: 'Loja 1', color: '#c53030', badgeColor: '#7a1a1a' },
  { value: 'Loja 2', label: 'Loja 2', color: '#3182ce', badgeColor: '#2768a5' },
  { value: 'Anexo', label: 'Anexo', color: '#38a169', badgeColor: '#2d8154' },
];

export const getStoreColor = (storeName) => {
  const store = STORE_OPTIONS.find(opt => opt.value === storeName);
  return store ? store.color : 'inherit';
};

export const getStoreBadgeColor = (storeName) =>
  STORE_OPTIONS.find(opt => opt.value === storeName)?.badgeColor;
