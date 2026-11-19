import { useState, useEffect, useCallback } from 'react';
import { itemService } from '@/services/itemService';
import { PAGINATION } from '@/constants/config';

const getStorageItem = (key, defaultValue) => {
  if (typeof window === 'undefined') return defaultValue;
  const saved = sessionStorage.getItem(`catalog_${key}`);
  if (saved !== null) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return saved;
    }
  }
  return defaultValue;
};

export function useCatalog(initialCategory = 'discos') {
  const [activeTab, setActiveTab] = useState(() => getStorageItem('activeTab', initialCategory));
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(() => getStorageItem('pagina', 1));
  const [filtroCaixa, setFiltroCaixa] = useState(() => getStorageItem('filtroCaixa', ''));
  const [filtroLoja, setFiltroLoja] = useState(() => getStorageItem('filtroLoja', ''));
  const [busca, setBusca] = useState(() => getStorageItem('busca', ''));
  const [mostrarAtivos, setMostrarAtivos] = useState(() => getStorageItem('mostrarAtivos', true));
  const [mostrarInativos, setMostrarInativos] = useState(() => getStorageItem('mostrarInativos', false));
  const [ordenarColuna, setOrdenarColuna] = useState(() => getStorageItem('ordenarColuna', null));
  const [ordenarDirecao, setOrdenarDirecao] = useState(() => getStorageItem('ordenarDirecao', null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('catalog_activeTab', JSON.stringify(activeTab));
      sessionStorage.setItem('catalog_pagina', JSON.stringify(pagina));
      sessionStorage.setItem('catalog_filtroCaixa', JSON.stringify(filtroCaixa));
      sessionStorage.setItem('catalog_filtroLoja', JSON.stringify(filtroLoja));
      sessionStorage.setItem('catalog_busca', JSON.stringify(busca));
      sessionStorage.setItem('catalog_mostrarAtivos', JSON.stringify(mostrarAtivos));
      sessionStorage.setItem('catalog_mostrarInativos', JSON.stringify(mostrarInativos));
      sessionStorage.setItem('catalog_ordenarColuna', JSON.stringify(ordenarColuna));
      sessionStorage.setItem('catalog_ordenarDirecao', JSON.stringify(ordenarDirecao));
    }
  }, [activeTab, pagina, filtroCaixa, filtroLoja, busca, mostrarAtivos, mostrarInativos, ordenarColuna, ordenarDirecao]);

  const fetchCatalogItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count } = await itemService.fetchItems(activeTab, {
        pagina,
        itensPorPagina: PAGINATION.ITEMS_PER_PAGE,
        filtroCaixa,
        filtroLoja,
        busca,
        mostrarAtivos,
        mostrarInativos,
        ordenarColuna,
        ordenarDirecao
      });
      setItens(data || []);
      setTotal(count || 0);
      setError(null);
    } catch (error) {
      console.error("Erro ao buscar itens:", error);
      setItens([]);
      setTotal(0);
      setError('Não foi possível carregar o estoque. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagina, filtroCaixa, filtroLoja, busca, mostrarAtivos, mostrarInativos, ordenarColuna, ordenarDirecao]);

  useEffect(() => {
    // Debounce for text search
    const delay = setTimeout(() => {
      fetchCatalogItems();
    }, 300);

    return () => clearTimeout(delay);
  }, [fetchCatalogItems]);

  // Seletor "Ordenar" dos filtros: coluna e direção de uma vez (null volta à ordem padrão).
  const definirOrdenacao = (coluna, direcao) => {
    setOrdenarColuna(coluna || null);
    setOrdenarDirecao(coluna ? direcao : null);
    setPagina(1);
  };

  const toggleOrdenacao = (coluna) => {
    if (ordenarColuna === coluna) {
      if (ordenarDirecao === 'asc') setOrdenarDirecao('desc');
      else {
        setOrdenarColuna(null);
        setOrdenarDirecao(null);
      }
    } else {
      setOrdenarColuna(coluna);
      setOrdenarDirecao('asc');
    }
    setPagina(1);
  };

  const changeTab = (newTab) => {
    if (newTab === activeTab) return;

    // Salva o estado da aba atual para restaurar se o usuário voltar
    try {
      const tabMemory = JSON.parse(sessionStorage.getItem('catalog_tab_memory') || '{}');
      tabMemory[activeTab] = {
        pagina,
        filtroCaixa,
        busca,
        ordenarColuna,
        ordenarDirecao
      };
      sessionStorage.setItem('catalog_tab_memory', JSON.stringify(tabMemory));

      // Restaura o estado anterior da nova aba se já tiver sido visitada
      const savedNewTab = tabMemory[newTab];
      if (savedNewTab) {
        setPagina(savedNewTab.pagina || 1);
        setFiltroCaixa(savedNewTab.filtroCaixa || '');
        setBusca(savedNewTab.busca || '');
        setOrdenarColuna(savedNewTab.ordenarColuna || null);
        setOrdenarDirecao(savedNewTab.ordenarDirecao || null);
      } else {
        setPagina(1);
        setFiltroCaixa('');
        setBusca('');
        setOrdenarColuna(null);
        setOrdenarDirecao(null);
      }
    } catch (e) {
      setPagina(1);
      setFiltroCaixa('');
      setBusca('');
    }

    setActiveTab(newTab);
  };

  return {
    activeTab,
    changeTab,
    itens,
    total,
    pagina,
    setPagina,
    filtroCaixa,
    setFiltroCaixa: (val) => { setFiltroCaixa(val); setPagina(1); },
    filtroLoja,
    setFiltroLoja: (val) => { setFiltroLoja(val); setPagina(1); },
    busca,
    setBusca: (val) => { setBusca(val); setPagina(1); },
    mostrarAtivos,
    setMostrarAtivos: (val) => { setMostrarAtivos(val); setPagina(1); },
    mostrarInativos,
    setMostrarInativos: (val) => { setMostrarInativos(val); setPagina(1); },
    ordenarColuna,
    ordenarDirecao,
    toggleOrdenacao,
    definirOrdenacao,
    loading,
    error,
    refresh: fetchCatalogItems,
    setItens,
    setTotal
  };
}
