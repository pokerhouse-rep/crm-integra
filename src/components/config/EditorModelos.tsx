'use client'

import { useState, useTransition } from 'react'
import type { ModeloMensagem } from '@/lib/servicos/tipos'
import { VARIAVEIS_MODELO, preencherModelo } from '@/lib/dominio/mensagens'
import { acaoExcluirModelo, acaoSalvarModelo } from '@/app/(app)/config/actions'

const EXEMPLO = { nome: 'Maria', empresa: 'Clínica Sorriso', link_mvp: 'https://exemplo.com/demo', cidade: 'Palmas' }
const campo =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

function FormModelo({ modelo }: { modelo: ModeloMensagem | null }) {
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [texto, setTexto] = useState(modelo?.texto ?? '')
  const [passo, setPasso] = useState(modelo?.passo != null ? String(modelo.passo) : '')
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    setOk(false)
    iniciar(async () => {
      const r = await acaoSalvarModelo(modelo?.id ?? null, nome, texto, passo)
      if (r.erro) {
        setErro(r.erro)
        return
      }
      setOk(true)
      if (!modelo) {
        setNome('')
        setTexto('')
        setPasso('')
      }
    })
  }

  function excluir() {
    if (!modelo || pendente) return
    if (!window.confirm(`Excluir o modelo "${modelo.nome}"?`)) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoExcluirModelo(modelo.id)
      if (r.erro) setErro(r.erro)
    })
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block text-sm text-slate-700">
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>
        <label className="block text-sm text-slate-700">
          Passo
          <input
            type="text"
            inputMode="numeric"
            value={passo}
            onChange={(e) => setPasso(e.target.value)}
            placeholder="Avulso"
            className={campo}
          />
        </label>
      </div>
      <label className="block text-sm text-slate-700">
        Texto
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={`${campo} py-2`} />
      </label>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <span className="block text-xs font-medium text-slate-500">Pré-visualização</span>
        {preencherModelo(texto, EXEMPLO) || '—'}
      </p>
      {erro && (
        <p role="alert" className="rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
      {ok && modelo && (
        <p role="status" className="text-sm text-marinho">
          Modelo salvo.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : modelo ? 'Salvar modelo' : 'Adicionar modelo'}
        </button>
        {modelo && (
          <button
            type="button"
            disabled={pendente}
            onClick={excluir}
            className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-laranja focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
          >
            Excluir
          </button>
        )}
      </div>
    </form>
  )
}

export function EditorModelos({ modelos }: { modelos: ModeloMensagem[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Variáveis disponíveis:{' '}
        {VARIAVEIS_MODELO.map((v) => (
          <code key={v} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{`{${v}}`}</code>
        ))}
        . O passo liga o modelo ao retorno de mesmo número; vazio = mensagem avulsa.
      </p>
      {modelos.length === 0 && <p className="text-sm text-slate-500">Nenhum modelo ainda. Crie o primeiro abaixo.</p>}
      {modelos.map((m) => (
        <div key={`${m.id}-${m.nome}-${m.texto}-${m.passo}`} className="rounded-lg border border-slate-200 p-3">
          <FormModelo modelo={m} />
        </div>
      ))}
      <details className="rounded-lg border border-dashed border-slate-300 p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium text-marinho">Novo modelo</summary>
        <div className="mt-2">
          <FormModelo modelo={null} />
        </div>
      </details>
    </div>
  )
}
