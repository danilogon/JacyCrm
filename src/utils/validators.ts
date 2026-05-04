export function validateCpfCnpj(value: string): { valid: boolean; tipo: 'PF' | 'PJ' | null } {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return { valid: true, tipo: 'PF' };
  if (digits.length === 14) return { valid: true, tipo: 'PJ' };
  return { valid: false, tipo: null };
}
