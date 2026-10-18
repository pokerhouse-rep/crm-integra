import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { DataISO } from '@/lib/dominio/datas'
import type { Etapa, OrigemRetorno, Resultado } from '@/lib/dominio/tipos'

export type { SupabaseClient }

/** Erro de regra de negócio; a mensagem está em pt-BR e pode ser exibida ao usuário. */
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroNegocio'
  }
}

export interface Config {
  sequenciaPadrao: number[]
  diasReativacao: number
  diasRetornoProposta: number
  diasLembreteCobranca: number
}

export interface Lead {
  id: string
  user_id: string
  nome_contato: string
  empresa: string | null
  whatsapp: string
  email: string | null
  cidade: string | null
  nicho_id: string | null
  origem_id: string | null
  link_mvp: string | null
  mvp_enviado_em: DataISO | null
  etapa: Etapa
  frio: boolean
  motivo_perda_id: string | null
  cliente: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
}

/** Lead da lista, com a data do próximo retorno pendente (null se não houver). */
export interface LeadResumo extends Lead {
  proximo_retorno: DataISO | null
}

export interface DadosLead {
  nomeContato: string
  whatsapp: string
  empresa?: string | null
  email?: string | null
  cidade?: string | null
  nichoId?: string | null
  origemId?: string | null
  linkMvp?: string | null
  observacoes?: string | null
}

export type StatusRetorno = 'pendente' | 'feito' | 'cancelado'

export interface Retorno {
  id: string
  user_id: string
  lead_id: string
  data_prevista: DataISO
  ciclo: number
  origem: OrigemRetorno
  status: StatusRetorno
  resultado: Resultado | null
  feito_em: string | null
  created_at: string
}

export interface Evento {
  id: string
  user_id: string
  lead_id: string
  tipo: string
  dados: Record<string, unknown> | null
  ocorrido_em: string
}

export interface LeadDetalhe {
  lead: Lead
  retornos: Retorno[]
  eventos: Evento[]
}

export interface Tarefa {
  id: string
  user_id: string
  lead_id: string | null
  titulo: string
  data: DataISO
  hora: string | null
  feita: boolean | null
  feita_em: string | null
  created_at: string
}

export interface ModeloMensagem {
  id: string
  user_id: string
  nome: string
  texto: string
  passo: number | null
}

/** Converte erro do Supabase em Error comum (erros inesperados, não de regra). */
export function lancarSeErro(erro: PostgrestError | null, contexto: string): void {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
}

export interface Opcao {
  id: string
  user_id: string
  tipo: 'nicho' | 'origem' | 'motivo_perda'
  nome: string
  ativo: boolean | null
  ordem: number | null
}
