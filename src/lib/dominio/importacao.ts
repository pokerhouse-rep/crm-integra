import { normalizarTelefone } from '@/lib/dominio/telefone'
import type { DadosLead } from '@/lib/servicos/tipos'

export type CampoImportacao =
  | 'nome'
  | 'empresa'
  | 'whatsapp'
  | 'email'
  | 'cidade'
  | 'nicho'
  | 'origem'
  | 'link_mvp'
  | 'observacoes'

export const LIMITE_LINHAS_IMPORTACAO = 1000
export const LIMITE_BYTES_IMPORTACAO = 1_048_576

export function normalizarTexto(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

const SINONIMOS: Record<CampoImportacao, string[]> = {
  nome: ['nome', 'nome do contato', 'contato'],
  empresa: ['empresa', 'nome da empresa', 'imobiliaria'],
  whatsapp: ['whatsapp', 'telefone', 'celular', 'fone', 'zap'],
  email: ['email', 'e-mail'],
  cidade: ['cidade'],
  nicho: ['nicho', 'segmento'],
  origem: ['origem'],
  link_mvp: ['link do mvp', 'link mvp', 'mvp', 'link'],
  observacoes: ['observacoes', 'observacao', 'obs'],
}

const CAMPO_POR_NOME = new Map<string, CampoImportacao>()
for (const [campo, nomes] of Object.entries(SINONIMOS) as [CampoImportacao, string[]][]) {
  for (const n of nomes) CAMPO_POR_NOME.set(n, campo)
}

export function mapearCabecalho(cabecalho: string[]): {
  colunas: (CampoImportacao | null)[]
  ignoradas: string[]
  erro: string | null
} {
  const usados = new Set<CampoImportacao>()
  const colunas: (CampoImportacao | null)[] = []
  const ignoradas: string[] = []
  for (const h of cabecalho) {
    const campo = CAMPO_POR_NOME.get(normalizarTexto(h)) ?? null
    if (campo && !usados.has(campo)) {
      usados.add(campo)
      colunas.push(campo)
    } else {
      colunas.push(null)
      ignoradas.push(h)
    }
  }
  const erro = usados.has('nome') && usados.has('whatsapp')
    ? null
    : 'A planilha precisa das colunas "nome" e "whatsapp".'
  return { colunas, ignoradas, erro }
}

export interface OpcoesImportacao {
  nichos: { id: string; nome: string }[]
  origens: { id: string; nome: string }[]
  nichoPadraoId: string | null
  origemPadraoId: string | null
  whatsappsExistentes: Set<string>
}

export type SituacaoLinha = 'nova' | 'duplicada_crm' | 'duplicada_planilha' | 'invalida'

export interface LinhaImportacao {
  numero: number
  situacao: SituacaoLinha
  motivo: string | null
  avisos: string[]
  dados: DadosLead | null
}

/** Não confere o limite de linhas; quem chama confere antes. */
export function validarLinhas(
  linhas: string[][],
  colunas: (CampoImportacao | null)[],
  o: OpcoesImportacao,
): LinhaImportacao[] {
  const nichos = new Map(o.nichos.map((n) => [normalizarTexto(n.nome), n.id]))
  const origens = new Map(o.origens.map((n) => [normalizarTexto(n.nome), n.id]))
  const vistos = new Map<string, number>()

  return linhas.map((cel, i) => {
    const numero = i + 2
    const v = (campo: CampoImportacao): string => {
      const idx = colunas.indexOf(campo)
      return idx < 0 ? '' : (cel[idx] ?? '').trim()
    }
    const opc = (campo: CampoImportacao): string | undefined => v(campo) || undefined
    const rejeitar = (situacao: SituacaoLinha, motivo: string): LinhaImportacao =>
      ({ numero, situacao, motivo, avisos: [], dados: null })

    const nome = v('nome')
    if (!nome) return rejeitar('invalida', 'Nome vazio.')
    const whatsapp = normalizarTelefone(v('whatsapp'))
    if (!whatsapp) return rejeitar('invalida', 'WhatsApp inválido.')
    if (o.whatsappsExistentes.has(whatsapp)) return rejeitar('duplicada_crm', 'WhatsApp já cadastrado no CRM.')
    const anterior = vistos.get(whatsapp)
    if (anterior !== undefined) {
      return rejeitar('duplicada_planilha', `WhatsApp repetido na planilha (linha ${anterior}).`)
    }
    vistos.set(whatsapp, numero)

    const avisos: string[] = []
    let nichoId: string | undefined = o.nichoPadraoId ?? undefined
    const nichoTxt = v('nicho')
    if (nichoTxt) {
      nichoId = nichos.get(normalizarTexto(nichoTxt))
      if (!nichoId) avisos.push(`Nicho "${nichoTxt}" não cadastrado; ficará em branco.`)
    }
    let origemId: string | undefined = o.origemPadraoId ?? undefined
    const origemTxt = v('origem')
    if (origemTxt) {
      origemId = origens.get(normalizarTexto(origemTxt))
      if (!origemId) avisos.push(`Origem "${origemTxt}" não cadastrada; ficará em branco.`)
    }

    const dados: DadosLead = {
      nomeContato: nome,
      whatsapp,
      empresa: opc('empresa'),
      email: opc('email'),
      cidade: opc('cidade'),
      nichoId,
      origemId,
      linkMvp: opc('link_mvp'),
      observacoes: opc('observacoes'),
    }
    return { numero, situacao: 'nova', motivo: null, avisos, dados }
  })
}
