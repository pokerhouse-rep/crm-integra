'use client'

import { useState, useTransition } from 'react'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import {
  acaoAdicionarRetorno,
  acaoAlterarDataRetorno,
  acaoCancelarRetorno,
  acaoTrocarSequencia,
  type RespostaAcao,
} from '@/app/(app)/leads/actions'
import { SeletorNovaData } from '@/components/hoje/SeletorNovaData'

export interface RetornoPendente {
  id: string
  dataPrevista: DataISO
  ciclo: number
  rotuloOrigem: string
}

interface Props {
  leadId: string
  hoje: DataISO
  retornos: RetornoPendente[]
  sequenciaPadrao: number[]
}

const botao =
  'min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

export function EditorRetornos({ leadId, hoje, retornos, sequenciaPadrao }: Props) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState<'novo' | 'sequencia' | null>(null)
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [sequencia, setSequencia] = useState(sequenciaPadrao.join(', '))

  function rodar(fn: () => Promise<RespostaAcao>, aoSucesso?: () => void) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (r.erro) setErro(r.erro)
      else aoSucesso?.()
    })
  }

  function limparRascunho(id: string) {
    setRascunhos((atual) => {
      const resto = { ...atual }
      delete resto[id]
      return resto
    })
  }

  return (
    <section aria-labelledby="titulo-retornos" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="titulo-retornos" className="text-base font-semibold text-marinho">
        Retornos pendentes
      </h2>

      {retornos.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Nenhum retorno pendente.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {retornos.map((r) => {
            const valor = rascunhos[r.id] ?? r.dataPrevista
            const alterado = valor !== r.dataPrevista
            return (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                  <span className="font-medium text-slate-800">{formatarDataBR(r.dataPrevista)}</span>
                  <span className="text-xs text-slate-500">
                    {r.rotuloOrigem}
                    {r.ciclo > 1 ? ` · ciclo ${r.ciclo}` : ''}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="min-w-40 flex-1 text-sm text-slate-700">
                    Mudar data
                    <input
                      type="date"
                      value={valor}
                      onChange={(e) => setRascunhos((atual) => ({ ...atual, [r.id]: e.target.value }))}
                      className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul"
                    />
                  </label>
                  {alterado && (
                    <button
                      type="button"
                      disabled={pendente || !valor}
                      onClick={() => rodar(() => acaoAlterarDataRetorno(leadId, r.id, valor), () => limparRascunho(r.id))}
                      className={`${botao} bg-marinho text-white`}
                    >
                      Salvar data
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => rodar(() => acaoCancelarRetorno(leadId, r.id))}
                    className={`${botao} border border-slate-300 text-slate-700`}
                  >
                    Cancelar retorno
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPainel(painel === 'novo' ? null : 'novo')}
          className={`${botao} border border-marinho text-marinho`}
        >
          + Adicionar retorno
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPainel(painel === 'sequencia' ? null : 'sequencia')}
          className={`${botao} border border-marinho text-marinho`}
        >
          Trocar sequência
        </button>
      </div>

      {painel === 'novo' && (
        <SeletorNovaData
          hoje={hoje}
          pendente={pendente}
          onEscolher={(data) => rodar(() => acaoAdicionarRetorno(leadId, data), () => setPainel(null))}
          onCancelar={() => setPainel(null)}
        />
      )}

      {painel === 'sequencia' && (
        <form
          className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            rodar(() => acaoTrocarSequencia(leadId, sequencia), () => setPainel(null))
          }}
        >
          <label htmlFor="sequencia-offsets" className="block text-sm font-medium text-slate-700">
            Dias a partir de hoje
          </label>
          <input
            id="sequencia-offsets"
            type="text"
            inputMode="numeric"
            value={sequencia}
            onChange={(e) => setSequencia(e.target.value)}
            placeholder="3, 7, 15"
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul"
          />
          <p className="mt-1 text-xs text-slate-500">
            Substitui todos os retornos pendentes. Datas em fim de semana vão para segunda-feira.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pendente}
              onClick={() => setPainel(null)}
              className={`${botao} border border-slate-300 text-slate-700`}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pendente} className={`${botao} bg-marinho text-white`}>
              Aplicar sequência
            </button>
          </div>
        </form>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
    </section>
  )
}
