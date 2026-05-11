/**
 * Abre um arquivo (data URL ou base64 puro + mime) em nova aba do navegador.
 * PDFs e imagens são renderizados; outros formatos o browser baixa normalmente.
 * @param data  Data URL completa ("data:mime;base64,xxx") OU base64 puro
 * @param mime  Mime type — obrigatório quando `data` é base64 puro
 */
export function abrirArquivoNoNavegador(data: string, mime?: string): void {
  let base64: string;
  let type: string;

  if (data.startsWith('data:')) {
    // Data URL completa: "data:application/pdf;base64,JVBERi..."
    const comma = data.indexOf(',');
    base64 = data.slice(comma + 1);
    type = data.slice(5, data.indexOf(';')) || mime || 'application/octet-stream';
  } else {
    // Base64 puro
    base64 = data;
    type = mime || 'application/octet-stream';
  }

  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type });
  window.open(URL.createObjectURL(blob), '_blank');
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value) + '%';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Converte um valor de percentual vindo de planilha para número real (ex: 10.5).
 * Excel armazena células formatadas como % no valor decimal (10% → 0.1).
 * Com raw:true o XLSX retorna 0.1 → precisamos multiplicar por 100.
 *
 * Regras:
 *  - String terminando em "%" → strip e usa o número (ex: "10%" → 10)
 *  - Número 0 < n < 1         → multiplica por 100 (raw decimal do Excel, ex: 0.1 → 10)
 *  - Qualquer outro número    → usa como está (já em % real, ex: "10" → 10)
 */
export function parsePercent(raw: string | number | unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // String com sinal de %: "10%" → 10
  if (s.endsWith('%')) return parseFloat(s) || 0;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  // Decimal do Excel (0 < n < 1): 0.1 → 10%
  if (n > 0 && n < 1) return n * 100;
  return n;
}

/**
 * Converte qualquer representação de data vinda de planilha para YYYY-MM-DD.
 * Suporta:
 *  - Número serial do Excel  (ex: "46950" ou 46950)
 *  - DD/MM/YYYY              (ex: "29/04/2026")
 *  - DD-MM-YYYY              (ex: "29-04-2026")
 *  - YYYY-MM-DD              (já no formato correto)
 *  - YYYY/MM/DD
 * Retorna '' se não reconhecer.
 */
export function parseImportDate(raw: string | number | unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // JS Date object (pode vir de cellDates:true)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(raw).trim();
  if (!s) return '';

  // Número serial do Excel (dias desde 1900-01-01, com bug do ano bissexto 1900)
  const serial = Number(s);
  if (!isNaN(serial) && serial > 1 && serial < 2958466 && !/\/|-/.test(s)) {
    // Fórmula de conversão: serial 1 = 1900-01-01 no Excel
    const ms = (serial - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    if (!isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // DD/MM/YYYY ou DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD ou YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

export function generateId(): string {
  // Usa crypto.randomUUID quando disponível; fallback com getRandomValues
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('') + Date.now().toString(36);
}

export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
