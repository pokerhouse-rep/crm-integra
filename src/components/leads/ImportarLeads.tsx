'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { LinhaImportacao, SituacaoLinha } from '@/lib/dominio/importacao'
import { formatarTelefone } from '@/lib/dominio/telefone'
import {
  acaoConfirmarImportacao,
  acaoPreviaImportacao,
  type RespostaImportacao,
} from '@/app/(app)/leads/importar/actions'

interface Props {
  nichos: { id: string; nome: string }[]
  origens: { id: string; nome: string }[]
  origemPadraoId: string
}

const entrada =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

const ROTULO: Record<SituacaoLinha, string> = {
  nova: 'Nova',
  duplicada_crm: 'Já no CRM',
  duplicada_planilha: 'Repetida',
  invalida: 'Erro',
}

export function ImportarLeads({ nichos, origens, origemPadraoId }: Props) {
  const [arquivoChave, setArquivoChave] = useState(0)
  const [linhas, setLinhas] = useState<LinhaImportacao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RespostaImportacao | null>(null)
  const [pendente, iniciar] = useTransition()

  function ver(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pendente) return
    const form = new FormData(e.currentTarget)
    setErro(null)
    setResultado(null)
    setLinhas(null)
    iniciar(async () => {
      const r = await acaoPreviaImportacao(form)
      if (r.erro) setErro(r.erro)
      else setLinhas(r.linhas ?? [])
    })
  }

  const novas = (linhas ?? []).filter((l) => l.situacao === 'nova')
  const conta = (s: SituacaoLinha) => (linhas ?? []).filter((l) => l.situacao === s).length

  function confirmar() {
    if (pendente || novas.length === 0) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoConfirmarImportacao(novas.map((l) => l.dados!))
      if (r.erro) {
        setErro(r.erro)
        return
      }
      setResultado(r)
      setLinhas(null)
      setArquivoChave((k) => k + 1)
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={ver} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          Nicho padrão
          <select name="nichoId" defaultValue="" className={entrada}>
            <option value="">Nenhum</option>
            {nichos.map((n) => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          Origem padrão
          <select name="origemId" defaultValue={origemPadraoId} className={entrada}>
            <option value="">Nenhuma</option>
            {origens.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          Arquivo CSV
          <input
            key={arquivoChave}
            type="file"
            name="arquivo"
            accept=".csv,text/csv"
            required
            className={`${entrada} py-2`}
          />
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-azul px-4 text-sm font-medium text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-azul"
        >
          {pendente && !linhas ? 'Lendo…' : 'Ver prévia'}
        </button>
      </form>

      {erro && (
        <p role="alert" className="rounded-lg border border-laranja bg-white p-3 text-sm text-laranja">{erro}</p>
      )}

      {resultado && (
        <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p className="font-medium text-marinho">{resultado.importados} leads importados.</p>
          {!!resultado.ignorados && <p>{resultado.ignorados} ignorados porque já existiam.</p>}
          <Link href="/leads" className="mt-2 flex min-h-11 items-center font-medium text-azul underline">
            Ver leads
          </Link>
        </div>
      )}

      {linhas && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Prévia">
          <p className="text-sm font-medium text-marinho">
            {conta('nova')} novos · {conta('duplicada_crm')} já no CRM · {conta('duplicada_planilha')} repetidos ·{' '}
            {conta('invalida')} com erro
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Linha</th>
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">WhatsApp</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 font-medium">Avisos</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.numero} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3">{l.numero}</td>
                    <td className="py-2 pr-3">{l.dados?.nomeContato ?? '—'}</td>
                    <td className="py-2 pr-3">{l.dados ? formatarTelefone(l.dados.whatsapp) : '—'}</td>
                    <td className="py-2 pr-3">
                      {ROTULO[l.situacao]}
                      {l.motivo && <span className="block text-slate-500">{l.motivo}</span>}
                    </td>
                    <td className="py-2 text-slate-500">{l.avisos.join(' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={confirmar}
            disabled={pendente || novas.length === 0}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-laranja px-4 text-sm font-medium text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-azul"
          >
            {pendente ? 'Importando…' : `Importar ${novas.length} leads`}
          </button>
        </section>
      )}
    </div>
  )
}
