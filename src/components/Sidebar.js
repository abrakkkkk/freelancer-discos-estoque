'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PiVinylRecord } from "react-icons/pi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { MdLayers, MdHistory } from "react-icons/md";
import { useStore } from '@/contexts/StoreContext';
import { STORE_OPTIONS } from '@/constants/config';
import LogoutButton from '@/components/LogoutButton';

const links = [
  { href: '/', label: 'Catálogo', icon: <PiVinylRecord size={18} /> },
  { href: '/adicionar', label: 'Adicionar Itens', icon: <IoIosAddCircleOutline size={18} /> },
  { href: '/lote', label: 'Alteração em Lote', icon: <MdLayers size={18} /> },
  { href: '/movimentacoes', label: 'Movimentações', icon: <MdHistory size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeStore, setActiveStore } = useStore();

  return (
    <aside className="sidebar">
      <div className="logo_free" style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: 'translateX(12px)' }}>
          <Image src="/logo-desktop.jpg" alt="Freelancer Discos" width={130} height={78} style={{ width: '130px', height: 'auto', display: 'block' }} unoptimized={true} priority />
        </div>
      </div>
      <div className="sidebar-title">Estoque Geral</div>

      <div style={{ padding: '0 12px', marginBottom: '20px' }}>
        <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
          Loja Ativa
        </label>
        <select
          value={activeStore}
          onChange={(e) => setActiveStore(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 32px 10px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.03) url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 12px center',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
        >
          <option value="" style={{ background: '#1c1c21', color: '#fff' }}>Todas as Lojas</option>
          {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} style={{ background: '#1c1c21', color: '#fff' }}>{opt.label}</option>)}
        </select>
      </div>

      <nav>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'active' : ''}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {link.icon && <span>{link.icon}</span>}
            {link.label}
          </Link>
        ))}
      </nav>
      <LogoutButton />
    </aside>
  );
}
