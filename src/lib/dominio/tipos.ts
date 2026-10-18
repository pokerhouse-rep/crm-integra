export type Etapa =
  | 'prospect'
  | 'mvp_enviado'
  | 'em_conversa'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export const ETAPAS: { valor: Etapa; rotulo: string }[] = [
  { valor: 'prospect', rotulo: 'Prospect' },
  { valor: 'mvp_enviado', rotulo: 'MVP enviado' },
  { valor: 'em_conversa', rotulo: 'Em conversa' },
  { valor: 'proposta_enviada', rotulo: 'Proposta enviada' },
  { valor: 'negociacao', rotulo: 'Negociação' },
  { valor: 'fechado', rotulo: 'Fechado' },
  { valor: 'perdido', rotulo: 'Perdido' },
]

export type Resultado = 'respondeu' | 'pediu_tempo' | 'sem_interesse' | 'sem_resposta'

export type OrigemRetorno = 'sequencia' | 'reativacao' | 'adiado' | 'manual' | 'proposta'

export type TipoValor = 'unico' | 'recorrente'
export type StatusProposta = 'rascunho' | 'enviada' | 'aceita' | 'recusada'
export type StatusContrato = 'ativo' | 'pausado' | 'cancelado'
export type StatusCobranca = 'aberta' | 'paga' | 'suspensa'
export type TipoCobranca = 'avista' | 'parcela' | 'mensalidade'
export type Competencia = string // 'YYYY-MM-01'
