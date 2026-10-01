import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { MenuItem } from '../lib/menu';

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isVeg: boolean;
};

type CartState = {
  lines: CartLine[];
  notes: string;
  setNotes: (notes: string) => void;
  addItem: (item: MenuItem) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState('');

  const value = useMemo<CartState>(() => {
    const addItem = (item: MenuItem) => {
      if (!item.isAvailable) {
        return;
      }
      setLines((current) => {
        const index = current.findIndex((line) => line.menuItemId === item.id);
        if (index === -1) {
          return [
            ...current,
            {
              menuItemId: item.id,
              name: item.name,
              unitPrice: item.price,
              quantity: 1,
              isVeg: item.isVeg,
            },
          ];
        }
        const next = [...current];
        next[index] = { ...next[index], quantity: next[index].quantity + 1 };
        return next;
      });
    };

    const setQuantity = (menuItemId: string, quantity: number) => {
      setLines((current) => {
        if (quantity <= 0) {
          return current.filter((line) => line.menuItemId !== menuItemId);
        }
        return current.map((line) =>
          line.menuItemId === menuItemId ? { ...line, quantity } : line,
        );
      });
    };

    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    return {
      lines,
      notes,
      setNotes,
      addItem,
      setQuantity,
      clear: () => {
        setLines([]);
        setNotes('');
      },
      itemCount,
      subtotal,
    };
  }, [lines, notes]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
