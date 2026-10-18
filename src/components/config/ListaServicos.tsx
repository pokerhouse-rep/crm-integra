'use client'

import { useState, useTransition } from 'react'
import type { ServicoCatalogo } from '@/lib/servicos/tipos'
import { formatarReais } from '@/lib/dominio/dinheiro'
import { acaoSalvarServico } from '@/app/(app)/config/actions'

const campo =
  'block min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'
const botao =
  'min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
const rotuloTipo = { unico: 'Valor único', recorrente: 'Mensal' } as const

function centavosParaTexto(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',')
}

function Linha({ servico }: { servico: ServicoCatalogo }) {
  const ativo = servico.ativo !== false
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(servico.nome)
  const [tipo, setTipo] = useState<string>(servico.tipo)
  const [preco, setPreco] = useState(centavosParaTexto(servico.preco_centavos))
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function salvar(novoAtivo: boolean, depois?: () => void) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoSalvarServico(servico.id, nome, tipo, preco, novoAtivo)
      if (r.erro) setErro(r.erro)
      else depois?.()
    })
  }

  return (
    <li className="py-2">
      {editando ? (
        <div className="space-y-2">
          <label className="block text-sm text-slate-700">
            Nome do serviço
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={`${campo} mt-1 w-full`} />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1 text-sm text-slate-700">
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${campo} mt-1 w-full`}>
                <option value="unico">Valor único</option>
                <option value="recorrente">Mensal</option>
              </select>
            </label>
            <label className="block flex-1 text-sm text-slate-700">
              Preço de referência (R$)
              <input type="text" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} className={`${campo} mt-1 w-full`} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pendente} onClick={() => salvar(ativo, () => setEditando(false))} className={botao}>
              Salvar
            </button>
            <button type="button" disabled={pendente} onClick={() => setEditando(false)} className={botao}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className={`min-w-0 flex-1 ${ativo ? '' : 'text-slate-400'}`}>
            <p className="truncate text-base">{servico.nome}</p>
            <p className="text-xs">
              {rotuloTipo[servico.tipo]} · {formatarReais(servico.preco_centavos)}
              {ativo ? '' : ' · inativo'}
            </p>
          </div>
          <button type="button" disabled={pendente} onClick={() => setEditando(true)} className={botao} aria-label={`Editar ${servico.nome}`}>
            Editar
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => salvar(!ativo)}
            className={botao}
            aria-label={`${ativo ? 'Desativar' : 'Reativar'} ${servico.nome}`}
          >
            {ativo ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-1 text-sm text-laranja">
          {erro}
        </p>
      )}
    </li>
  )
}

export function ListaServicos({ servicos }: { servicos: ServicoCatalogo[] }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('unico')
  const [preco, setPreco] = useState('')
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoSalvarServico(null, nome, tipo, preco, true)
      if (r.erro) setErro(r.erro)
      else {
        setNome('')
        setPreco('')
      }
    })
  }

  return (
    <div>
      {servicos.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum serviço ainda. Adicione o primeiro abaixo.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {servicos.map((s) => (
            <Linha key={`${s.id}-${s.nome}-${s.tipo}-${s.preco_centavos}-${s.ativo}`} servico={s} />
          ))}
        </ul>
      )}
      <form onSubmit={adicionar} className="mt-3 space-y-2">
        <label className="block text-sm text-slate-700">
          Novo serviço
          <input type="text" placeholder="Nome do serviço" value={nome} onChange={(e) => setNome(e.target.value)} className={`${campo} mt-1 w-full`} />
        </label>
        <div className="flex gap-2">
          <label className="block flex-1 text-sm text-slate-700">
            Tipo do novo serviço
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${campo} mt-1 w-full`}>
              <option value="unico">Valor único</option>
              <option value="recorrente">Mensal</option>
            </select>
          </label>
          <label className="block flex-1 text-sm text-slate-700">
            Preço de referência (R$)
            <input type="text" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} className={`${campo} mt-1 w-full`} />
          </label>
        </div>
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          Adicionar serviço
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
