export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || value === 0) return '-';
  return 'Rp' + value.toLocaleString('id-ID');
}
