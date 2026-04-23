'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  HiHome,
  HiCurrencyDollar,
  HiCreditCard,
  HiChartPie,
  HiFlag,
  HiTag,
  HiLogout,
} from 'react-icons/hi';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HiHome },
  { href: '/transactions', label: 'Transações', icon: HiCurrencyDollar },
  { href: '/accounts', label: 'Contas', icon: HiCreditCard },
  { href: '/budgets', label: 'Orçamentos', icon: HiChartPie },
  { href: '/goals', label: 'Metas', icon: HiFlag },
  { href: '/categories', label: 'Categorias', icon: HiTag },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 flex flex-col h-screen flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white text-xl font-bold tracking-tight">
          💰 Finance OS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-white truncate">
            {user?.nome ?? 'Usuário'}
          </p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <HiLogout className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
