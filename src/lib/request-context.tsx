'use client';

import { createContext, useContext, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '@/hooks/useAuth';
import { getProductsByIds } from './data';
import type { CartItem, DbRequest } from '@/types/types';
import { formatCurrency } from './format-utils';
import { calculatePriceTotal, getCurrentAuthUser, recordOrderEvent } from './workflow';

type RequestContextType = {
  items: CartItem[];
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: number;
  submit: (args: {
    priority: DbRequest['priority'];
    reason?: DbRequest['reason'];
    promise_date?: string;
    payment_note?: string;
  }) => Promise<void>;
};

const RequestContext = createContext<RequestContextType | null>(null);

export default function RequestProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { profile } = useAuth();

  const add = (id: string) => {
    setItems((prev) => {
      const exist = prev.find((item) => item.id === id);
      if (exist) {
        return prev.map((item) =>
          item.id === id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { id, qty: 1 }];
    });
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clear = () => setItems([]);

  const total = items.reduce((acc, item) => acc + item.qty, 0);

  const submit = async ({
    priority,
    reason,
    promise_date,
    payment_note,
  }: {
    priority: DbRequest['priority'];
    reason?: DbRequest['reason'];
    promise_date?: string;
    payment_note?: string;
  }) => {
    const user = await getCurrentAuthUser();
    if (items.length === 0) throw new Error('Cart is empty');

    const uniqueIds = [...new Set(items.map((item) => item.id))];
    const nameMap = await getProductsByIds(uniqueIds);

    const enrichedItems = items.map((item) => ({
      ...item,
      name: nameMap.get(item.id) || undefined,
    }));

    if (
      profile?.debt_amount &&
      profile?.debt_limit &&
      profile.debt_amount > profile.debt_limit
    ) {
      if (!promise_date) {
        throw new Error(
          `Debt exceeds limit (${formatCurrency(profile.debt_amount)}). Promise date required`
        );
      }

      const { error: promiseError } = await supabase
        .from('payment_promises')
        .insert([
          {
            user_id: user.id,
            user_email: user.email || null,
            promise_date,
            note: payment_note,
            request_id: null,
          },
        ]);

      if (promiseError) throw new Error(promiseError.message);
    }

    let priceTotal = 0;
    try {
      priceTotal = await calculatePriceTotal(enrichedItems, profile?.client_type || 'regular');
    } catch {
      console.warn('Price calculation failed; submitting with price_total = 0');
    }

    const requestPayload = {
      user_id: user.id,
      user_email: user.email || profile?.email || null,
      items: enrichedItems,
      total,
      price_total: priceTotal,
      status: 'pending' as const,
      priority,
      reason: reason || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('requests')
      .insert([requestPayload])
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await recordOrderEvent(data as DbRequest, {
      actorId: user.id,
      actorEmail: user.email || profile?.email,
      action: 'request_submitted',
      message: `New request submitted by ${user.email || 'client'}`,
      type: 'info',
      notifyRequester: false,
      notifyRoles: ['marketing', 'boss', 'admin', 'owner'],
      metadata: {
        item_count: enrichedItems.length,
        total_quantity: total,
        price_total: priceTotal,
        priority,
      },
    });

    clear();
  };

  return (
    <RequestContext.Provider value={{ items, add, remove, clear, total, submit }}>
      {children}
    </RequestContext.Provider>
  );
}

export const useRequest = () => {
  const context = useContext(RequestContext);
  if (!context) throw new Error('useRequest must be used inside RequestProvider');
  return context;
};
