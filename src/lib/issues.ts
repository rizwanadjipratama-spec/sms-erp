import { supabase } from './supabase';

export const submitOrderIssue = async (
  orderId: string,
  reporterId: string,
  description: string
) => {
  const { error } = await supabase.from('issues').insert({
    order_id: orderId,
    reported_by: reporterId,
    description: description.trim(),
    status: 'open',
  });

  if (error) throw new Error(error.message);
};
