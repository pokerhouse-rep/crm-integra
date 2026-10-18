import type { StatusProposta } from '@/lib/dominio/tipos'

export const ROTULO_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
}

export const COR_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  enviada: 'bg-azul/15 text-marinho',
  aceita: 'bg-emerald-100 text-emerald-800',
  recusada: 'bg-slate-200 text-slate-600',
}
