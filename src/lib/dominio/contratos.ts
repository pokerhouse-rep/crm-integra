import { formatarReais } from './dinheiro'
import type { TipoValor } from './tipos'

export function descreverItem(i: {
  tipo: TipoValor
  valor_centavos: number
  parcelas: number
  mes_inicio: string | null
}): string {
  if (i.tipo === 'recorrente') {
    const desde = i.mes_inicio ? ` desde ${i.mes_inicio.slice(5, 7)}/${i.mes_inicio.slice(0, 4)}` : ''
    return `${formatarReais(i.valor_centavos)}/mês${desde}`
  }
  return i.parcelas > 1 ? `${formatarReais(i.valor_centavos)} em ${i.parcelas}x` : `${formatarReais(i.valor_centavos)} à vista`
}
