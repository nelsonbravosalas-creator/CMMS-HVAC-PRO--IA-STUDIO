import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  isSidebarOpen: boolean;
  activeModal: string | null;
  activeTab: string;
  isScrolled: boolean;
  
  // Actions
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  setActiveTab: (tab: string) => void;
  setScrolled: (scrolled: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      activeModal: null,
      activeTab: 'dashboard',
      isScrolled: false,

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebar: (open) => set({ isSidebarOpen: open }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setScrolled: (scrolled) => set({ isScrolled: scrolled }),
    }),
    {
      name: 'cmms-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen, activeTab: state.activeTab }),
    }
  )
);
