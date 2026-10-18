'use client'

import { useEffect, useRef, useState } from 'react'
import {
  diaVencimentoPadrao,
  horizonteCobrancas,
  planejarCobrancasIniciais,
  rotuloCobranca,
} from '@/lib/dominio/cobrancas'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { formatarReais } from '@/lib/dominio/dinheiro'
import { totaisProposta, valorLiquido, type ItemProposta } from '@/lib/dominio/propostas'
import { dataValida } from '@/lib/validacao'

interface Props {
  itens: ItemProposta[]
  tituloProposta: string
  hoje: DataISO
  pendente: boolean
  erro?: string | null
  onConfirmar: (v: {
    diaVencimento: string
    primeiroVencimento: string
    descricao: string
    itens: number
    unicoCentavos: number
    recorrenteCentavos: number
  }) => void
  onCancelar: () => void
}

export function DialogoAceite({ itens, tituloProposta, hoje, pendente, erro, onConfirmar, onCancelar }: Props) {
  const [dia, setDia] = useState(String(diaVencimentoPadrao(hoje)))
  const [primeiro, setPrimeiro] = useState<string>(hoje)
  const [descricao, setDescricao] = useState(tituloProposta)
  const campoDia = useRef<HTMLInputElement>(null)
  const cancelarRef = useRef(onCancelar)
  const pendenteRef = useRef(pendente)
  useEffect(() => {
    cancelarRef.current = onCancelar
    pendenteRef.current = pendente
  })
  useEffect(() => {
    campoDia.current?.focus()
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pendenteRef.current) cancelarRef.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  const diaNum = Number(dia)
  const diaOk = /^\d{1,2}$/.test(dia.trim()) && diaNum >= 1 && diaNum <= 28
  const dataOk = dataValida(primeiro)

  // Mesmos dados que o servidor usa (valor líquido por item, horizonte de hoje).
  const cobrancas =
    diaOk && dataOk
      ? planejarCobrancasIniciais(
          itens.map((i) => ({
            tipo: i.tipo,
            valorCentavos: valorLiquido(i),
            parcelas: i.parcelas,
            mesInicio: i.mesInicio,
          })),
          { diaVencimento: diaNum, primeiroVencimento: primeiro, ate: horizonteCobrancas(hoje) },
        )
      : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendente) onCancelar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-aceite"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 md:max-w-lg md:rounded-2xl"
      >
        <h2 id="titulo-aceite" className="text-lg font-semibold text-marinho">
          Aceitar proposta
        </h2>
        <p className="mt-1 text-sm text-slate-600">Isso cria o contrato e as cobranças abaixo, e o lead vira cliente.</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-700">
            Dia de vencimento (1 a 28)
            <input
              ref={campoDia}
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="block text-sm text-slate-700">
            1º vencimento
            <input
              type="date"
              value={primeiro}
              onChange={(e) => setPrimeiro(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-slate-700">
          Descrição do contrato
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          />
        </label>

        <h3 className="mt-4 text-sm font-semibold text-marinho">Cobranças que serão geradas</h3>
        {!diaOk || !dataOk ? (
          <p className="mt-1 text-sm text-slate-600">Informe um dia entre 1 e 28 e uma data válida para ver a prévia.</p>
        ) : cobrancas.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Nenhuma cobrança por enquanto.</p>
        ) : (
          <ul className="mt-1 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 px-3">
            {cobrancas.map((c, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="break-words text-slate-800">
                    {rotuloCobranca({ ...c, descricaoItem: itens[c.itemIndice].descricao })}
                  </p>
                  <p className="text-xs text-slate-500">vence em {formatarDataBR(c.vencimento)}</p>
                </div>
                <p className="shrink-0 font-medium text-slate-800">{formatarReais(c.valorCentavos)}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Mensalidades seguintes são geradas automaticamente a cada mês.
        </p>

        {erro && (
          <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
            {erro}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={pendente}
            className="min-h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pendente || !diaOk || !dataOk}
            onClick={() => {
              const t = totaisProposta(itens)
              onConfirmar({
                diaVencimento: dia,
                primeiroVencimento: primeiro,
                descricao,
                itens: itens.length,
                unicoCentavos: t.unicoCentavos,
                recorrenteCentavos: t.recorrenteCentavos,
              })
            }}
            className="min-h-11 rounded-lg bg-laranja text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
          >
            {pendente ? 'Aceitando…' : 'Confirmar aceite'}
          </button>
        </div>
      </div>
    </div>
  )
}
