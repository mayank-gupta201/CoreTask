import { create } from 'zustand';

interface PortfolioState {
    portfolios: any[];
    activePortfolioId: string | null;
    setPortfolios: (portfolios: any[]) => void;
    setActivePortfolio: (id: string | null) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
    portfolios: [],
    activePortfolioId: null,
    setPortfolios: (portfolios) => set({ portfolios }),
    setActivePortfolio: (id) => set({ activePortfolioId: id })
}));
