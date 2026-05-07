import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item && 'transform' in item;
}

// Worker via CDN para evitar configuração extra no Vite
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface DadosCotacao {
  nome: string;
  cpfCnpj: string;           // formatado, ex: "389.624.858-85"
  dataNascimento: string;    // YYYY-MM-DD
  dataNascimentoRaw: string; // DD/MM/YYYY como está no PDF
  telefone: string;
  email: string;
  ramoKeyword: string;       // "Automóvel", "Residência", "Empresa"…
  tipoSeguro: string;        // "Novo" | "Renovação"
}

// Palavras-chave do PDF → possíveis nomes de ramo no sistema
const RAMO_ALIASES: Array<{ keyword: string; aliases: string[] }> = [
  { keyword: 'Automóvel', aliases: ['auto', 'automóvel', 'autom', 'veículos', 'veiculo'] },
  { keyword: 'Residência', aliases: ['residencial', 'residência', 'residencia', 'resid'] },
  { keyword: 'Empresa',    aliases: ['empresarial', 'empresa', 'comercial'] },
  { keyword: 'Vida',       aliases: ['vida'] },
  { keyword: 'Saúde',      aliases: ['saúde', 'saude', 'health'] },
  { keyword: 'Viagem',     aliases: ['viagem', 'travel'] },
];

export function mapRamoToSystem(ramoKeyword: string, nomesDosRamos: string[]): string {
  const kw = ramoKeyword.toLowerCase().trim();
  for (const entry of RAMO_ALIASES) {
    if (kw === entry.keyword.toLowerCase() || entry.aliases.some(a => kw.includes(a))) {
      const found = nomesDosRamos.find(r =>
        entry.aliases.some(a => r.toLowerCase().includes(a))
      );
      if (found) return found;
    }
  }
  return nomesDosRamos.find(r => r.toLowerCase().includes(kw)) ?? '';
}

// ── Extração dos itens de texto com posição ─────────────────────────────────

type RawItem = { str: string; x: number; y: number };

async function extractItems(file: File): Promise<RawItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const items: RawItem[] = [];

  // Apenas a página 1 contém os dados do segurado.
  // A página 2 é a tabela de resultados/preços e contamina a extração.
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  for (const raw of content.items as (TextItem | TextMarkedContent)[]) {
    if (!isTextItem(raw)) continue;
    const s = raw.str.trim();
    if (!s) continue;
    const x = raw.transform[4];
    const y = raw.transform[5];
    // Remove duplicatas: alguns PDFs renderizam cada glifo duas vezes
    // com posições quasi-idênticas (Δx < 2, Δy < 2)
    const isDup = items.some(p => p.str === s && Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2);
    if (!isDup) items.push({ str: s, x, y });
  }
  return items;
}

/**
 * Reconstrói linhas a partir de itens.
 * No espaço PDF, y=0 fica na base → ordenar y DESCENDENTE = de cima para baixo.
 * Itens com Δy ≤ tolerance são tratados como mesma linha (ordenados por x).
 */
function buildLines(items: RawItem[], yTolerance = 4): string[] {
  if (items.length === 0) return [];

  // Ordena: y desc (cima→baixo), x asc (esq→dir) dentro da mesma linha
  const sorted = [...items].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > yTolerance) return dy > 0 ? 1 : -1;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentLine: string[] = [sorted[0].str];
  let refY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - refY) <= yTolerance) {
      currentLine.push(item.str);
    } else {
      lines.push(currentLine.join(' ').trim());
      currentLine = [item.str];
      refY = item.y;
    }
  }
  if (currentLine.length) lines.push(currentLine.join(' ').trim());

  return lines.filter(l => l.length > 0);
}

// ── Parser principal ────────────────────────────────────────────────────────

export async function parsePdfCotacao(file: File): Promise<DadosCotacao> {
  const allItems = await extractItems(file);

  // ────────────────────────────────────────────────────────────────────────
  // O PDF do Agger usa layout multi-coluna (4 colunas para Auto,
  // 3–4 para Residência/Empresa).  Quando agrupamos por Y, as colunas
  // ficam misturadas na mesma linha.
  //
  // Solução: localiza o item "SEGURADO/CONDUTOR" ou "SEGURADO" e usa
  // seu x como âncora para delimitar a COLUNA ESQUERDA (x ≤ âncora + 130).
  // Nessa coluna ficam: nome, CPF/CNPJ, NASCIMENTO, TELEFONE, E-MAIL.
  //
  // Para RAMO e TIPO SEGURO usamos o texto completo, pois estão em
  // colunas diferentes.
  // ────────────────────────────────────────────────────────────────────────

  const seguradoItem = allItems.find(i => /^SEGURADO(\/CONDUTOR)?:?$/.test(i.str.trim()));
  // Detecta a coluna CONDUTOR para limitar o xMax dinamicamente.
  // Em PDFs com SEGURADO + CONDUTOR lado a lado (layout Auto do Agger),
  // usar ponto médio entre as duas colunas evita misturar os dados.
  const condutorItem = allItems.find(i => /^CONDUTOR$/.test(i.str.trim()));
  const xMax = seguradoItem
    ? (condutorItem
        ? (seguradoItem.x + condutorItem.x) / 2   // ponto médio entre as colunas
        : seguradoItem.x + 100)                     // sem CONDUTOR: offset fixo
    : 180;

  // Coluna esquerda: dados do segurado
  const leftItems = allItems.filter(i => i.x <= xMax);
  const leftLines = buildLines(leftItems);

  // Texto completo (para ramo e tipo seguro)
  const fullLines = buildLines(allItems);
  const fullText  = fullLines.join('\n');

  // ── Nome ──────────────────────────────────────────────────────────────
  let nome = '';
  for (let i = 0; i < leftLines.length; i++) {
    if (/^SEGURADO(\/CONDUTOR)?:?$/.test(leftLines[i].trim())) {
      const parts: string[] = [];
      for (let j = i + 1; j < leftLines.length; j++) {
        const l = leftLines[j].trim();
        if (!l) continue;
        // Para ao chegar no label CPF/CNPJ ou no próprio valor do CPF
        if (/^CPF\s*\/?\s*CNPJ/.test(l)) break;
        if (/^\d{3}\.\d{3}/.test(l) || /^\d{2}\.\d{3}/.test(l)) break;
        // Para em labels todos-caps com mais de 2 chars (NASCIMENTO, TELEFONE…)
        // mas NÃO para em partículas de nome como "De", "Da", "Do"
        if (l === l.toUpperCase() && /^[A-ZÁÉÍÓÚÂÊÎÔÛÀÃÕÇ\s\-\/]+$/.test(l) && l.length > 2) break;
        parts.push(l);
      }
      nome = parts.join(' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // ── CPF / CNPJ ─────────────────────────────────────────────────────────
  // Prefere a coluna esquerda (dados do segurado) para evitar pegar o CPF
  // do condutor ou de outros blocos quando o PDF tem layout multi-coluna.
  const leftText  = leftLines.join('\n');
  const cnpjMatch = leftText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) ?? fullText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  const cpfMatch  = leftText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)        ?? fullText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const cpfCnpj   = cnpjMatch?.[0] ?? cpfMatch?.[0] ?? '';

  // ── Data de Nascimento ────────────────────────────────────────────────
  let dataNascimentoRaw = '';
  for (let i = 0; i < leftLines.length; i++) {
    if (/^NASCIMENTO$/.test(leftLines[i].trim())) {
      const next = leftLines[i + 1]?.trim() ?? '';
      const m = next.match(/\d{2}\/\d{2}\/\d{4}/);
      if (m) dataNascimentoRaw = m[0];
      break;
    }
  }
  let dataNascimento = '';
  if (dataNascimentoRaw) {
    const [d, mo, y] = dataNascimentoRaw.split('/');
    dataNascimento = `${y}-${mo}-${d}`;
  }

  // ── Telefone ──────────────────────────────────────────────────────────
  let telefone = '';
  for (let i = 0; i < leftLines.length; i++) {
    if (/^TELEFONE$/.test(leftLines[i].trim())) {
      const raw = leftLines[i + 1]?.trim() ?? '';
      // Se houver múltiplos separados por " / ", pega o primeiro
      telefone = raw.split(/\s*\/\s*/)[0].trim();
      break;
    }
  }

  // ── E-mail ────────────────────────────────────────────────────────────
  let email = '';
  for (let i = 0; i < leftLines.length; i++) {
    if (/^E-MAIL$/.test(leftLines[i].trim())) {
      const candidate = leftLines[i + 1]?.trim() ?? '';
      if (candidate.includes('@')) { email = candidate; break; }
    }
  }
  // Fallback: qualquer e-mail no documento que não seja da corretora
  if (!email) {
    const allEmails = fullText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
    email = allEmails.find(e =>
      !e.toLowerCase().includes('jacyara') &&
      !e.toLowerCase().includes('segura')
    ) ?? '';
  }

  // ── Ramo (precisa do texto completo, pois o título fica centrado) ─────
  let ramoKeyword = '';
  // Tenta a sequência "Cotação de Seguro" → próxima linha com o nome do ramo
  for (let i = 0; i < fullLines.length; i++) {
    if (/^Cota[çc][aã]o de Seguro$/.test(fullLines[i].trim())) {
      ramoKeyword = fullLines[i + 1]?.trim() ?? '';
      break;
    }
  }
  // Fallback: busca palavras-chave diretamente
  if (!ramoKeyword) {
    const kws = ['Automóvel', 'Residência', 'Empresa', 'Vida', 'Saúde', 'Viagem'];
    ramoKeyword = kws.find(k => fullText.includes(k)) ?? '';
  }

  // ── Tipo Seguro ───────────────────────────────────────────────────────
  // "TIPO SEGURO" fica na coluna da direita; usa texto completo com janela generosa
  let tipoSeguro = 'Novo';
  const tipoMatch = fullText.match(/TIPO[\s\S]{0,5}SEGURO[\s\S]{0,200}?(Renova[çc][aã]o|Novo)/i);
  if (tipoMatch) tipoSeguro = tipoMatch[1];

  return { nome, cpfCnpj, dataNascimento, dataNascimentoRaw, telefone, email, ramoKeyword, tipoSeguro };
}
