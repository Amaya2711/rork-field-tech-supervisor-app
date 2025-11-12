'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
};

// Menú de navegación principal - Actualizado con Google Maps
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio' },
  { href: '/sites-v1', label: 'Sites V1' },
  { href: '/cuadrillas', label: 'Cuadrillas' },
  { href: '/tickets-v1', label: 'Tickets V1' },
  { href: '/map-google', label: 'Google Maps' },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: '100%',
        padding: '10px 12px',
        borderBottom: '1px solid #e9ecef',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {NAV_ITEMS.filter((i) => !i.disabled).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: 14,
                textDecoration: 'none',
                color: active ? '#198754' : '#0d6efd',
                fontWeight: active ? 700 : 500,
                borderBottom: active ? '2px solid #198754' : '2px solid transparent',
                paddingBottom: 2,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
