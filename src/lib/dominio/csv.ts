export type Celula = string | number | null

const INICIO_FORMULA = new Set(['=', '+', '-', '@', '\t', '\r'])

function celulaParaCsv(c: Celula): string {
  if (c === null) return ''
  let s = String(c)
  if (s.length > 0 && INICIO_FORMULA.has(s[0])) s = `'${s}`
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** UTF-8 com BOM, separador `;`, quebra `\r\n`. Protege contra injeção de fórmula (D13). */
export function gerarCsv(linhas: Celula[][]): string {
  return '\uFEFF' + linhas.map((l) => l.map(celulaParaCsv).join(';') + '\r\n').join('')
}

function detectarSeparador(texto: string): string {
  let aspas = false
  for (const ch of texto) {
    if (ch === '"') aspas = !aspas
    else if (!aspas) {
      if (ch === ';') return ';'
      if (ch === '\n' || ch === '\r') break
    }
  }
  return ','
}

/** Lê CSV (RFC 4180). Separador `;` ou `,` pela 1ª linha. Ignora linhas vazias. */
export function lerCsv(entrada: string): string[][] {
  const texto = entrada.replace(/^\uFEFF/, '')
  const sep = detectarSeparador(texto)
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  let teveAspas = false

  const fecharCampo = () => {
    linha.push(campo)
    campo = ''
    teveAspas = false
  }
  const fecharLinha = () => {
    fecharCampo()
    if (!(linha.length === 1 && linha[0] === '')) linhas.push(linha)
    linha = []
  }

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else aspas = false
      } else campo += ch
    } else if (ch === '"') {
      aspas = true
      teveAspas = true
    } else if (ch === sep) fecharCampo()
    else if (ch === '\r') {
      if (texto[i + 1] === '\n') i++
      fecharLinha()
    } else if (ch === '\n') fecharLinha()
    else campo += ch
  }
  if (campo !== '' || teveAspas || linha.length > 0) fecharLinha()
  return linhas
}

/** UTF-8 estrito; se falhar, Windows-1252. */
export function decodificarArquivo(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** 150000 → '1500,00'; -5 → '-0,05'. */
export function centavosParaCsv(c: number): string {
  const abs = Math.abs(c)
  const reais = Math.trunc(abs / 100)
  const cent = String(abs % 100).padStart(2, '0')
  return `${c < 0 ? '-' : ''}${reais},${cent}`
}
