'use client';

import Link from 'next/link';
import Image from 'next/image';

import { useStore } from '@/contexts/StoreContext';
import { STORE_OPTIONS } from '@/constants/config';
import ReposicaoBell from '@/components/ReposicaoBell';
import LogoutButton from '@/components/LogoutButton';

import { usePathname } from 'next/navigation';

export default function MobileHeader() {
  const pathname = usePathname();
  const { activeStore, setActiveStore } = useStore();

  const handleNavigation = (e) => {
    if (window.innerWidth <= 768 && pathname !== '/') {
      const pagesToConfirm = ['/lote', '/adicionar'];
      if (pagesToConfirm.includes(pathname)) {
        const confirmed = window.confirm("Você tem certeza que quer sair dessa página?");
        if (!confirmed) {
          e.preventDefault();
        }
      }
    }
  };

  const activeLabel = activeStore ? STORE_OPTIONS.find(o => o.value === activeStore)?.label : 'Todas';

  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-header-brand" onClick={handleNavigation}>
        <Image 
          src="/logo.jpg" 
          alt="Freelancer Discos" 
          width={40}
          height={40}
          className="mobile-header-logo"
          unoptimized={true}
          priority
        />
        <div className="mobile-header-text">
          <span className="mobile-header-title">Freelancer Discos</span>
          <span className="mobile-header-subtitle">{activeLabel}</span>
        </div>
      </Link>
      <div className="mobile-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <select
          value={activeStore}
          onChange={(e) => setActiveStore(e.target.value)}
          style={{
            padding: '4px 6px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
            maxWidth: '120px',
          }}
        >
          <option value="">Todas</option>
          {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <ReposicaoBell />
        <LogoutButton compact />
      </div>
    </header>
  );
}
