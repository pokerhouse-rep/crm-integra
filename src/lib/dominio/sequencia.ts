import { agendarPrazo, type DataISO } from './datas'
import type { Etapa, OrigemRetorno, Resultado } from './tipos'

export interface EntradaResultado {
  resultado: Resultado
  hoje: DataISO
  /** Obrigatório se 'pediu_tempo'. */
  novaData?: DataISO
  /** Pendentes do lead, sem contar o retorno atual. */
  pendentesRestantes: number
  offsetsPadrao: number[]
  diasReativacao: number
  /** Origem do retorno que está sendo registrado (padrão: 'sequencia'). */
  origem?: OrigemRetorno
  /** Prazo do retorno pós-proposta, em dias corridos (padrão: 3). */
  diasRetornoProposta?: number
}

export interface PlanoResultado {
  cancelarPendentes: boolean
  novaEtapa: Etapa | null
  novosRetornos: { data: DataISO; origem: OrigemRetorno }[]
  frio: 'marcar' | 'limpar' | 'manter'
  pedirMotivoPerda: boolean
}

export function gerarDatasSequencia(base: DataISO, offsets: number[]): DataISO[] {
  return offsets.map(o => agendarPrazo(base, o))
}

export function gerarDatasReativacao(hoje: DataISO, offsets: number[], diasReativacao: number): DataISO[] {
  return offsets.map(o => agendarPrazo(hoje, diasReativacao + (o - offsets[0])))
}

export function planejarResultado(e: EntradaResultado): PlanoResultado {
  switch (e.resultado) {
    case 'respondeu':
      return { cancelarPendentes: true, novaEtapa: 'em_conversa', novosRetornos: [], frio: 'limpar', pedirMotivoPerda: false }
    case 'pediu_tempo':
      if (!e.novaData) throw new Error('novaData obrigatória')
      return {
        cancelarPendentes: true,
        novaEtapa: null,
        novosRetornos: [{ data: e.novaData, origem: 'adiado' }],
        frio: 'limpar',
        pedirMotivoPerda: false,
      }
    case 'sem_interesse':
      return { cancelarPendentes: true, novaEtapa: 'perdido', novosRetornos: [], frio: 'limpar', pedirMotivoPerda: true }
    case 'sem_resposta':
      if (e.pendentesRestantes > 0) {
        return { cancelarPendentes: false, novaEtapa: null, novosRetornos: [], frio: 'manter', pedirMotivoPerda: false }
      }
      if (e.origem === 'proposta') {
        return {
          cancelarPendentes: false,
          novaEtapa: null,
          novosRetornos: [{ data: agendarPrazo(e.hoje, e.diasRetornoProposta ?? 3), origem: 'proposta' as const }],
          frio: 'manter',
          pedirMotivoPerda: false,
        }
      }
      return {
        cancelarPendentes: false,
        novaEtapa: null,
        novosRetornos: gerarDatasReativacao(e.hoje, e.offsetsPadrao, e.diasReativacao).map(data => ({
          data,
          origem: 'reativacao' as const,
        })),
        frio: 'marcar',
        pedirMotivoPerda: false,
      }
  }
}
