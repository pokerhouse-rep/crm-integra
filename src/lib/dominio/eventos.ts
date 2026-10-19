import { formatarDataBR } from './datas'
import { formatarReais, formatarValorNegociacao } from './dinheiro'
import { ETAPAS } from './tipos'

const ROTULO_ETAPA = new Map<string, string>(ETAPAS.map((e) => [e.valor, e.rotulo]))

export const ROTULO_RESULTADO: Record<string, string> = {
  respondeu: 'Respondeu',
  pediu_tempo: 'Pediu tempo',
  sem_interesse: 'Sem interesse',
  sem_resposta: 'Sem resposta',
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Texto pt-BR de um evento do histórico (linha do tempo e exportação). Tipo desconhecido: o próprio tipo. */
export function descreverEvento(
  tipo: string,
  dados: Record<string, unknown> | null,
): { texto: string; detalhe?: string } {
  const d = dados ?? {}
  switch (tipo) {
    case 'criado':
      return { texto: 'Lead cadastrado' }
    case 'dados_editados':
      return { texto: 'Dados do lead editados' }
    case 'anotacao':
      return { texto: 'Anotação', detalhe: str(d.texto) ?? undefined }
    case 'mvp_enviado':
      return { texto: 'MVP enviado', detalhe: str(d.link) ?? undefined }
    case 'retorno_feito': {
      const res = ROTULO_RESULTADO[str(d.resultado) ?? ''] ?? 'Resultado registrado'
      const nova = str(d.nova_data)
      return {
        texto: `Retorno feito: ${res}`,
        detalhe: nova ? `Nova data: ${formatarDataBR(nova)}` : undefined,
      }
    }
    case 'etapa_alterada': {
      const de = ROTULO_ETAPA.get(str(d.de) ?? '') ?? str(d.de) ?? '?'
      const para = ROTULO_ETAPA.get(str(d.para) ?? '') ?? str(d.para) ?? '?'
      return { texto: `Etapa: ${de} → ${para}` }
    }
    case 'frio':
      return { texto: 'Lead ficou frio (sem resposta na sequência)' }
    case 'reativado':
      return { texto: 'Lead reativado: voltou a responder' }
    case 'tarefa_concluida':
      return { texto: 'Tarefa concluída', detalhe: str(d.titulo) ?? undefined }
    case 'proposta_criada':
      return { texto: 'Proposta criada' }
    case 'proposta_enviada': {
      const v = num(d.versao)
      const valor = formatarValorNegociacao({
        unicoCentavos: num(d.total_unico) ?? 0,
        recorrenteCentavos: num(d.total_recorrente) ?? 0,
      })
      const partes = [v !== null ? `v${v}` : null, valor || null].filter(Boolean)
      return { texto: `Proposta enviada${partes.length ? ` (${partes.join(' · ')})` : ''}` }
    }
    case 'proposta_nova_versao': {
      const v = num(d.versao)
      return { texto: `Nova versão da proposta${v !== null ? ` (v${v})` : ''}` }
    }
    case 'proposta_aceita':
      return { texto: 'Proposta aceita' }
    case 'proposta_recusada':
      return { texto: 'Proposta recusada' }
    case 'contrato_pausado':
      return { texto: 'Contrato pausado' }
    case 'contrato_reativado':
      return { texto: 'Contrato reativado' }
    case 'contrato_cancelado':
      return { texto: 'Contrato cancelado' }
    case 'contrato_reajustado': {
      const valor = num(d.valor)
      const de = str(d.a_partir_de)
      const quando = de ? ` a partir de ${de.slice(5, 7)}/${de.slice(0, 4)}` : ''
      return { texto: `Mensalidade reajustada${valor !== null ? ` para ${formatarReais(valor)}` : ''}${quando}` }
    }
    case 'cobranca_paga': {
      const valor = num(d.valor)
      return { texto: valor !== null ? `Pagamento registrado: ${formatarReais(valor)}` : 'Pagamento registrado' }
    }
    case 'pagamento_desfeito':
      return { texto: 'Pagamento desfeito' }
    default:
      return { texto: tipo }
  }
}
