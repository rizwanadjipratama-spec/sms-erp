'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { requireAuthUser } from '@/lib/db/client';
import { requestsDb, paymentPromisesDb, productsDb, priceListDb } from '@/lib/db';
import { notificationService } from '@/lib/services/notification-service';
import { activityLogsDb } from '@/lib/db';
import type { CartItem, DbRequest, ClientType } from '@/types/types';

type RequestContextType = {
  items: CartItem[];
  add: (id: string, name?: string) => void;
  remove: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  itemCount: number;
  submit: (args: {
    priority: DbRequest['priority'];
    note?: string;
    promise_date?: string;
    payment_note?: string;
  }) => Promise<DbRequest>;
};

const RequestContext = createContext<RequestContextType | null>(null);

async function calculateTotal(
  items: CartItem[],
  clientType: ClientType
): Promise<number> {
  // Cost Per Test clients have no upfront product pricing
  if (clientType === 'cost_per_test') return 0;

  const prices = await priceListDb.getAll();
  const priceMap = new Map(prices.map(p => [p.product_id, p]));

  return items.reduce((sum, item) => {
    const price = priceMap.get(item.id);
    if (!price) return sum;
    const unitPrice = clientType === 'kso' ? price.price_kso : price.price_regular;
    return sum + unitPrice * item.qty;
  }, 0);
}

export default function RequestProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { profile } = useAuth();

  const add = useCallback((id: string, name?: string) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item =>
          item.id === id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { id, qty: 1, name }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(item => item.id !== id));
    } else {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, qty } : item
      ));
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  const submit = useCallback(async ({
    priority,
    note,
    promise_date,
    payment_note,
  }: {
    priority: DbRequest['priority'];
    note?: string;
    promise_date?: string;
    payment_note?: string;
  }): Promise<DbRequest> => {
    if (items.length === 0) throw new Error('Cart is empty');

    const user = await requireAuthUser();

    // Check debt limit
    if (profile?.debt_amount && profile?.debt_limit && profile.debt_amount > profile.debt_limit) {
      if (!promise_date) {
        throw new Error('Debt exceeds limit. Payment promise date is required.');
      }

      await paymentPromisesDb.create({
        user_id: user.id,
        user_email: user.email ?? undefined,
        promise_date,
        note: payment_note,
      });
    }

    // Calculate price
    const clientType = profile?.client_type ?? 'regular';
    let totalPrice = 0;
    try {
      totalPrice = await calculateTotal(items, clientType);
    } catch {
      // Price calculation optional at submission; marketing will price later
    }

    // Create the request
    const request = await requestsDb.create({
      user_id: user.id,
      user_email: user.email ?? profile?.email,
      status: 'submitted',
      priority,
      total_price: totalPrice,
      note: note ?? undefined,
      created_by: user.id,
    });

    // Create request items
    const requestItems = items.map(item => ({
      request_id: request.id,
      product_id: item.id,
      quantity: item.qty,
      price_at_order: 0, // Marketing fills this at priced stage
    }));

    await requestsDb.createItems(requestItems);

    // Link payment promise to request if created
    if (promise_date && profile?.debt_amount && profile.debt_amount > (profile.debt_limit ?? 0)) {
      // Promise was already created above; we could update it but it's not critical
    }

    // Notify marketing
    await notificationService.notifyRoles(['marketing', 'admin'], {
      title: 'New Order',
      message: `New order submitted by ${user.email ?? 'client'}`,
      type: 'info',
      orderId: request.id,
    });

    // Activity log
    await activityLogsDb.create({
      user_id: user.id,
      user_email: user.email,
      action: 'submit_request',
      entity_type: 'request',
      entity_id: request.id,
      metadata: {
        item_count: items.length,
        total_quantity: itemCount,
        total_price: totalPrice,
        priority,
      },
    });

    clear();
    return request;
  }, [items, itemCount, profile, clear]);

  const value = useMemo(() => ({
    items, add, remove, updateQty, clear, itemCount, submit,
  }), [items, add, remove, updateQty, clear, itemCount, submit]);

  return (
    <RequestContext.Provider value={value}>
      {children}
    </RequestContext.Provider>
  );
}

export function useRequest() {
  const context = useContext(RequestContext);
  if (!context) throw new Error('useRequest must be used inside RequestProvider');
  return context;
}
