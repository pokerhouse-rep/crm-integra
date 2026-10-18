'use client'

import { useState, useTransition } from 'react'
import type { Opcao } from '@/lib/servicos/tipos'
import { acaoSalvarOpcao } from '@/app/(app)/config/actions'

const campo =
  'block min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'
const botao =
  'min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

function Linha({ opcao, tipo }: { opcao: Opcao; tipo: Opcao['tipo'] }) {
  const [nome, setNome] = useState(opcao.nome)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const ativo = opcao.ativo !== false

  function salvar(novoNome: string, novoAtivo: boolean) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoSalvarOpcao(opcao.id, tipo, novoNome, novoAtivo)
      if (r.erro) setErro(r.erro)
    })
  }

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={`Nome da opção ${opcao.nome}`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={`${campo} ${ativo ? '' : 'text-slate-400'}`}
        />
        {nome.trim() !== opcao.nome && (
          <button type="button" disabled={pendente} onClick={() => salvar(nome, ativo)} className={botao}>
            Salvar
          </button>
        )}
        <button
          type="button"
          disabled={pendente}
          onClick={() => salvar(opcao.nome, !ativo)}
          className={botao}
          aria-label={`${ativo ? 'Desativar' : 'Reativar'} ${opcao.nome}`}
        >
          {ativo ? 'Desativar' : 'Reativar'}
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-1 text-sm text-laranja">
          {erro}
        </p>
      )}
    </li>
  )
}

export function ListaOpcoes({ tipo, opcoes }: { tipo: Opcao['tipo']; opcoes: Opcao[] }) {
  const [novo, setNovo] = useState('')
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoSalvarOpcao(null, tipo, novo, true)
      if (r.erro) setErro(r.erro)
      else setNovo('')
    })
  }

  return (
    <div>
      {opcoes.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma opção ainda. Adicione a primeira abaixo.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {opcoes.map((o) => (
            <Linha key={`${o.id}-${o.nome}-${o.ativo}`} opcao={o} tipo={tipo} />
          ))}
        </ul>
      )}
      <form onSubmit={adicionar} className="mt-3 flex gap-2">
        <input
          type="text"
          aria-label="Nova opção"
          placeholder="Nova opção"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          className={campo}
        />
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>
      {erro && (
        <p role="alert" className="mt-1 text-sm text-laranja">
          {erro}
        </p>
      )}
    </div>
  )
}
