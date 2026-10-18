'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { horizonteCobrancas } from '@/lib/dominio/cobrancas'
import type { DataISO } from '@/lib/dominio/datas'
import { reaisParaCampo } from '@/lib/dominio/dinheiro'
import type { ItemProposta } from '@/lib/dominio/propostas'
import type { StatusProposta } from '@/lib/dominio/tipos'
import { converterItem, itemParaValores, type ValoresItem } from '@/lib/propostas-form'
import {
  acaoAceitarProposta,
  acaoEnviarProposta,
  acaoNovaVersao,
  acaoRecusarProposta,
  acaoSalvarItens,
} from '@/app/(app)/leads/[id]/propostas/actions'
import { DialogoAceite } from './DialogoAceite'
import { ItemLeitura } from './HistoricoVersoes'
import { ResumoTotais } from './ResumoTotais'

export interface ServicoOpcao {
  id: string
  nome: string
  tipo: 'unico' | 'recorrente'
  precoCentavos: number
}

interface Props {
  propostaId: string
  /** Versão exibida; enviada junto ao aceite para detectar aba desatualizada. */
  versaoId: string
  status: StatusProposta
  tituloProposta: string
  hoje: DataISO
  servicos: ServicoOpcao[]
  itensIniciais: ItemProposta[]
  contratoId: string | null
}

type ItemEditavel = ValoresItem & { chave: number }

const CAMPO =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'
const BOTAO_NEUTRO =
  'min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
const BOTAO_PRIMARIO =
  'min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
const BOTAO_CTA =
  'min-h-11 rounded-lg bg-laranja px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

function valoresDe(i: ItemEditavel): ValoresItem {
  return {
    servicoId: i.servicoId,
    descricao: i.descricao,
    tipo: i.tipo,
    valor: i.valor,
    parcelas: i.parcelas,
    mesInicio: i.mesInicio,
    descontoTipo: i.descontoTipo,
    desconto: i.desconto,
  }
}

export function EditorItens({
  propostaId,
  versaoId,
  status,
  tituloProposta,
  hoje,
  servicos,
  itensIniciais,
  contratoId,
}: Props) {
  const mesPadrao = horizonteCobrancas(hoje).slice(0, 7)
  const proximaChave = useRef(0)
  const novoItem = (v?: Partial<ValoresItem>): ItemEditavel => ({
    chave: proximaChave.current++,
    servicoId: '',
    descricao: '',
    tipo: 'unico',
    valor: '',
    parcelas: '1',
    mesInicio: mesPadrao,
    descontoTipo: '',
    desconto: '',
    ...v,
  })

  const [itens, setItens] = useState<ItemEditavel[]>(() =>
    itensIniciais.length > 0
      ? itensIniciais.map((i) => ({
          chave: proximaChave.current++,
          ...itemParaValores(i),
          mesInicio: i.mesInicio ? i.mesInicio.slice(0, 7) : mesPadrao,
        }))
      : [novoItem()],
  )
  const assinatura = (lista: ItemEditavel[]) => JSON.stringify(lista.map(valoresDe))
  const [salvo, setSalvo] = useState(() => assinatura(itens))
  const [erro, setErro] = useState<string | null>(null)
  const [erroAceite, setErroAceite] = useState<string | null>(null)
  const [aceitando, setAceitando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false) // trava toques duplos no mesmo quadro, antes de `pendente` atualizar

  function executarTravado(fn: () => Promise<void>) {
    if (pendente || ocupado.current) return
    ocupado.current = true
    iniciar(async () => {
      try {
        await fn()
      } finally {
        ocupado.current = false
      }
    })
  }

  const rascunho = status === 'rascunho'
  const sujo = rascunho && assinatura(itens) !== salvo

  const conversoes = useMemo(() => itens.map((v, i) => converterItem(v, i + 1)), [itens])
  const validos = conversoes.flatMap((c) => ('item' in c ? [c.item] : []))
  const itensResumo: ItemProposta[] = rascunho
    ? validos
    : itensIniciais

  function atualizar(chave: number, parte: Partial<ValoresItem>) {
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, ...parte } : i)))
  }

  function escolherServico(chave: number, servicoId: string) {
    const s = servicos.find((x) => x.id === servicoId)
    if (!s) {
      atualizar(chave, { servicoId: '' })
      return
    }
    atualizar(chave, {
      servicoId: s.id,
      descricao: s.nome,
      tipo: s.tipo,
      valor: reaisParaCampo(s.precoCentavos),
      parcelas: '1',
    })
  }

  async function salvar(): Promise<boolean> {
    const r = await acaoSalvarItens(propostaId, itens.map(valoresDe))
    if (r.erro) {
      setErro(r.erro)
      return false
    }
    setSalvo(assinatura(itens))
    return true
  }

  function rodar(fn: () => Promise<void>) {
    setErro(null)
    executarTravado(fn)
  }

  async function simples(acao: (id: string) => Promise<{ erro?: string }>) {
    const r = await acao(propostaId)
    if (r.erro) setErro(r.erro)
  }

  const aoSalvar = () => rodar(async () => void (await salvar()))
  const aoEnviar = () =>
    rodar(async () => {
      if (sujo && !(await salvar())) return
      await simples(acaoEnviarProposta)
    })
  const aoAceitar = () =>
    rodar(async () => {
      if (sujo && !(await salvar())) return
      setErroAceite(null)
      setAceitando(true)
    })
  const aoRecusar = () => rodar(() => simples(acaoRecusarProposta))
  const aoNovaVersao = () => rodar(() => simples(acaoNovaVersao))

  const itensDoAceite: ItemProposta[] = rascunho ? validos : itensIniciais

  return (
    <fieldset disabled={pendente} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <section aria-labelledby="titulo-itens" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="titulo-itens" className="text-base font-semibold text-marinho">
          Itens
        </h2>

        {!rascunho ? (
          itensIniciais.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Esta versão não tem itens.</p>
          ) : (
            <ul className="mt-1 divide-y divide-slate-100">
              {itensIniciais.map((i, idx) => (
                <ItemLeitura key={idx} item={i} />
              ))}
            </ul>
          )
        ) : (
          <div className="mt-3 space-y-4">
            {itens.map((it, idx) => {
              const n = idx + 1
              const conv = conversoes[idx]
              const aviso = 'erro' in conv && it.valor.trim() !== '' ? conv.erro : null
              const id = `item-${it.chave}`
              return (
                <fieldset key={it.chave} className="rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-medium text-marinho">Item {n}</legend>

                  {servicos.length > 0 && (
                    <label className="block text-sm text-slate-700">
                      Serviço do catálogo (opcional)
                      <select
                        value={it.servicoId}
                        onChange={(e) => escolherServico(it.chave, e.target.value)}
                        className={CAMPO}
                      >
                        <option value="">Item avulso</option>
                        {servicos.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="mt-3 block text-sm text-slate-700" htmlFor={`${id}-desc`}>
                    Descrição
                  </label>
                  <input
                    id={`${id}-desc`}
                    type="text"
                    value={it.descricao}
                    onChange={(e) => atualizar(it.chave, { descricao: e.target.value })}
                    className={CAMPO}
                  />

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block text-sm text-slate-700">
                      Tipo
                      <select
                        value={it.tipo}
                        onChange={(e) => atualizar(it.chave, { tipo: e.target.value, parcelas: '1' })}
                        className={CAMPO}
                      >
                        <option value="unico">Valor único</option>
                        <option value="recorrente">Mensal</option>
                      </select>
                    </label>
                    <label className="block text-sm text-slate-700">
                      Valor (R$)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.valor}
                        onChange={(e) => atualizar(it.chave, { valor: e.target.value })}
                        placeholder="0,00"
                        className={CAMPO}
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    {it.tipo === 'unico' ? (
                      <label className="block text-sm text-slate-700">
                        Parcelas (1 = à vista)
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={48}
                          value={it.parcelas}
                          onChange={(e) => atualizar(it.chave, { parcelas: e.target.value })}
                          className={CAMPO}
                        />
                      </label>
                    ) : (
                      <label className="block text-sm text-slate-700">
                        Mês de início
                        <input
                          type="month"
                          value={it.mesInicio}
                          onChange={(e) => atualizar(it.chave, { mesInicio: e.target.value })}
                          className={CAMPO}
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block text-sm text-slate-700">
                      Desconto
                      <select
                        value={it.descontoTipo}
                        onChange={(e) =>
                          atualizar(it.chave, {
                            descontoTipo: e.target.value as ValoresItem['descontoTipo'],
                            desconto: '',
                          })
                        }
                        className={CAMPO}
                      >
                        <option value="">Nenhum</option>
                        <option value="percentual">Percentual (%)</option>
                        <option value="valor">Valor (R$)</option>
                      </select>
                    </label>
                    {it.descontoTipo !== '' && (
                      <label className="block text-sm text-slate-700">
                        {it.descontoTipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={it.desconto}
                          onChange={(e) => atualizar(it.chave, { desconto: e.target.value })}
                          className={CAMPO}
                        />
                      </label>
                    )}
                  </div>

                  {aviso && (
                    <p role="alert" className="mt-2 text-sm text-laranja">
                      {aviso}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setItens((l) => l.filter((x) => x.chave !== it.chave))}
                    disabled={pendente}
                    className="mt-3 flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden /> Remover item {n}
                  </button>
                </fieldset>
              )
            })}

            <button type="button" onClick={() => setItens((l) => [...l, novoItem()])} className={`${BOTAO_NEUTRO} flex w-full items-center justify-center gap-1`}>
              <Plus size={16} aria-hidden /> Item
            </button>
          </div>
        )}
      </section>

      <ResumoTotais itens={itensResumo} />

      {erro && (
        <p role="alert" className="rounded-lg bg-laranja/10 p-3 text-sm text-laranja">
          {erro}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {status === 'rascunho' && (
          <>
            <button type="button" onClick={aoSalvar} disabled={pendente || !sujo} className={BOTAO_NEUTRO}>
              {pendente ? 'Aguarde…' : sujo ? 'Salvar' : 'Salvo'}
            </button>
            <button type="button" onClick={aoEnviar} disabled={pendente} className={BOTAO_PRIMARIO}>
              Enviar proposta
            </button>
            <button type="button" onClick={aoAceitar} disabled={pendente} className={BOTAO_CTA}>
              Aceitar
            </button>
          </>
        )}
        {status === 'enviada' && (
          <>
            <button type="button" onClick={aoAceitar} disabled={pendente} className={BOTAO_CTA}>
              Aceitar
            </button>
            <button type="button" onClick={aoRecusar} disabled={pendente} className={BOTAO_NEUTRO}>
              Recusar
            </button>
            <button type="button" onClick={aoNovaVersao} disabled={pendente} className={BOTAO_PRIMARIO}>
              Nova versão
            </button>
          </>
        )}
        {status === 'recusada' && (
          <button type="button" onClick={aoNovaVersao} disabled={pendente} className={BOTAO_PRIMARIO}>
            Nova versão
          </button>
        )}
        {status === 'aceita' && contratoId && (
          <Link
            href={`/clientes/${contratoId}`}
            className="flex min-h-11 items-center justify-center rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            Ver contrato
          </Link>
        )}
      </div>
      {rascunho && sujo && <p className="text-xs text-slate-500">Há alterações não salvas.</p>}

      {aceitando && (
        <DialogoAceite
          itens={itensDoAceite}
          tituloProposta={tituloProposta}
          hoje={hoje}
          pendente={pendente}
          erro={erroAceite}
          onCancelar={() => setAceitando(false)}
          onConfirmar={(v) => {
            setErroAceite(null)
            executarTravado(async () => {
              const r = await acaoAceitarProposta(propostaId, { ...v, versaoId })
              if (r?.erro) setErroAceite(r.erro)
            })
          }}
        />
      )}
    </fieldset>
  )
}
