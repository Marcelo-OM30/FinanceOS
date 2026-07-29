'use client';
import { HiMenu } from 'react-icons/hi';
import { useUiStore } from '@/store/ui.store';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const openSidebar = useUiStore((s) => s.openSidebar);

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center gap-3">
      <button
        onClick={openSidebar}
        className="lg:hidden -ml-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
        aria-label="Abrir menu"
      >
        <HiMenu className="h-6 w-6" />
      </button>

      {/* min-w-0 permite o truncate funcionar dentro do flex */}
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
