'use client';
import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}

// O Header é renderizado por cada página, e não pelo layout, então o botão de
// menu e o Sidebar não se enxergam pela árvore de componentes — daí o estado
// da gaveta viver aqui. Não é persistido: ao reabrir o app o menu começa fechado.
export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
