// Small shared formatters for public pages.

const rupiah0 = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** "Rp 44.464.144". null/undefined → null. */
export function formatRupiah(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return rupiah0.format(n);
}

/** Compact rupiah for tight spaces: "Rp 44,5 jt", "Rp 300 rb", "Rp 0". */
export function formatRupiahCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'Rp 0';
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1000)} rb`;
  return `Rp ${n}`;
}
