import { dataValida } from '@/lib/validacao'
import { formatarDataBR, hojeEmPalmas, somarDias, type DataISO } from './datas'

export type ChavePeriodo = 'mes' | 'mes_passado' | '30d' | '90d' | 'ano' | 'personalizado'

export interface Periodo {
  chave: ChavePeriodo
  de: DataISO
  ate: DataISO
}

export const PERIODOS: { valor: ChavePeriodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes_passado', rotulo: 'Mês passado' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: '90d', rotulo: 'Últimos 90 dias' },
  { valor: 'ano', rotulo: 'Este ano' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

/** Resolve o período da URL (D4). Qualquer valor inválido volta para "Este mês". */
export function resolverPeriodo(
  params: { periodo?: string; de?: string; ate?: string },
  hoje: DataISO,
): Periodo {
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`
  const padrao: Periodo = { chave: 'mes', de: primeiroDoMes, ate: hoje }

  switch (params.periodo) {
    case 'mes_passado': {
      const fimMesPassado = somarDias(primeiroDoMes, -1)
      return { chave: 'mes_passado', de: `${fimMesPassado.slice(0, 7)}-01`, ate: fimMesPassado }
    }
    case '30d':
      return { chave: '30d', de: somarDias(hoje, -29), ate: hoje }
    case '90d':
      return { chave: '90d', de: somarDias(hoje, -89), ate: hoje }
    case 'ano':
      return { chave: 'ano', de: `${hoje.slice(0, 4)}-01-01`, ate: hoje }
    case 'personalizado': {
      const { de, ate } = params
      if (!de || !ate || !dataValida(de) || !dataValida(ate)) return padrao
      return de <= ate ? { chave: 'personalizado', de, ate } : { chave: 'personalizado', de: ate, ate: de }
    }
    default:
      return padrao
  }
}

/** Intervalo [inicio, fim) em UTC para filtrar timestamptz por dias de Palmas (UTC-3). */
export function intervaloUTC(p: { de: DataISO; ate: DataISO }): { inicio: string; fim: string } {
  return { inicio: `${p.de}T03:00:00Z`, fim: `${somarDias(p.ate, 1)}T03:00:00Z` }
}

export function dataEmPalmas(timestamp: string): DataISO {
  return hojeEmPalmas(new Date(timestamp))
}

export function rotuloPeriodo(p: Periodo): string {
  return `${formatarDataBR(p.de)} a ${formatarDataBR(p.ate)}`
}
