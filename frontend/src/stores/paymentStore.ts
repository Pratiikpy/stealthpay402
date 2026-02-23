import { create } from "zustand";

interface Payment {
  id: string;
  from: string;
  stealthAddress: string;
  amount: string;
  fee: string;
  timestamp: number;
  txHash: string;
}

interface PaymentStore {
  payments: Payment[];
  totalVolume: number;
  totalPayments: number;
  totalFees: number;
  addPayment: (payment: Payment) => void;
  setStats: (stats: { totalVolume: number; totalPayments: number; totalFees: number }) => void;
}

export const usePaymentStore = create<PaymentStore>((set) => ({
  payments: [],
  totalVolume: 0,
  totalPayments: 0,
  totalFees: 0,
  addPayment: (payment) =>
    set((state) => ({
      payments: [payment, ...state.payments].slice(0, 100),
      totalPayments: state.totalPayments + 1,
      totalVolume: state.totalVolume + parseFloat(payment.amount),
      totalFees: state.totalFees + parseFloat(payment.fee),
    })),
  setStats: (stats) => set(stats),
}));
