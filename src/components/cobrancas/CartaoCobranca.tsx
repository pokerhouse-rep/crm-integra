'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { mensagemCobranca, podeDesfazerPagamento, situacaoCobranca } from '@/lib/dominio/cobrancas'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { formatarReais, lerReais, reaisParaCampo } from '@/lib/dominio/dinheiro'
import { linkWhatsApp } from '@/lib/dominio/mensagens'
import type { CobrancaResumo } from '@/lib/servicos/cobrancas'
import { acaoDesfazerPagamento, acaoEditarCobranca, acaoMarcarPago } from '@/app/(app)/clientes/actions'

interface Props {
  cobranca: CobrancaResumo
  hoje: DataISO
  diasLembrete: number
  /** Mostra "Editar" (vencimento e valor) nas cobranças não pagas. */
  permitirEdicao?: boolean
}

const SELO = {
  paga: { texto: 'Paga', classe: 'bg-emerald-100 text-emerald-800' },
  suspensa: { texto: 'Suspensa', classe: 'bg-slate-200 text-slate-600' },
  atrasada: { texto: 'Atrasada', classe: 'bg-laranja/15 text-laranja' },
  vencendo: { texto: 'Vencendo', classe: 'bg-azul/15 text-marinho' },
  futura: { texto: 'A vencer', classe: 'bg-slate-100 text-slate-700' },
} as const

/** Tempo em que o cartão recém-recebido fica na tela com "Desfazer" antes de a tela ser atualizada. */
const SEGUNDOS_DESFAZER = 10

// Um único temporizador para a tela toda: vários "Recebido" seguidos atualizam a tela uma vez só,
// 10 s depois do último. Sobrevive à navegação, então também limpa o cache das telas visitadas.
let temporizadorAtualizar: ReturnType<typeof setTimeout> | undefined
function agendarAtualizacao(atualizar: () => void) {
  clearTimeout(temporizadorAtualizar)
  temporizadorAtualizar = setTimeout(atualizar, SEGUNDOS_DESFAZER * 1000)
}

const botaoBase =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
const campo = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base'

export function CartaoCobranca({ cobranca: c, hoje, diasLembrete, permitirEdicao = false }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  // Valor recebido agora há pouco: o cartão continua visível com "Desfazer" (em Hoje ele sumiria na hora).
  const [recemPago, setRecemPago] = useState<number | null>(null)
  const ocupado = useRef(false)
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState<'outro' | 'editar' | null>(null)
  const [dataPago, setDataPago] = useState<string>(hoje)
  const [valorPago, setValorPago] = useState(reaisParaCampo(c.valor_centavos))
  const [vencimentoEd, setVencimentoEd] = useState<string>(c.vencimento)
  const [valorEd, setValorEd] = useState(reaisParaCampo(c.valor_centavos))

  // Campos sempre recomeçam dos valores ATUAIS da cobrança ao abrir o painel.
  function alternar(p: 'outro' | 'editar') {
    if (painel === p) {
      setPainel(null)
      return
    }
    setErro(null)
    if (p === 'outro') {
      setDataPago(hoje)
      setValorPago(reaisParaCampo(c.valor_centavos))
    } else {
      setVencimentoEd(c.vencimento)
      setValorEd(reaisParaCampo(c.valor_centavos))
    }
    setPainel(p)
  }

  const situacao = situacaoCobranca(c, hoje, diasLembrete)
  const selo = SELO[situacao]
  const atrasada = situacao === 'atrasada'
  const aberta = c.status === 'aberta'
  const naoPaga = c.status !== 'paga'

  function rodar(acao: () => Promise<{ erro?: string }>, aoConcluir?: () => void) {
    if (ocupado.current) return
    ocupado.current = true
    setErro(null)
    iniciar(async () => {
      try {
        const r = await acao()
        if (r.erro) setErro(r.erro)
        else {
          setPainel(null)
          aoConcluir?.()
        }
      } finally {
        ocupado.current = false
      }
    })
  }

  function receber(dataPagamento?: string, valor?: string) {
    const recebido = valor !== undefined ? (lerReais(valor) ?? c.valor_centavos) : c.valor_centavos
    rodar(
      () => acaoMarcarPago(c.id, dataPagamento, valor),
      () => {
        setRecemPago(recebido)
        agendarAtualizacao(() => router.refresh())
      },
    )
  }

  function desfazer() {
    rodar(
      () => acaoDesfazerPagamento(c.id),
      () => {
        if (recemPago !== null) clearTimeout(temporizadorAtualizar)
        setRecemPago(null)
      },
    )
  }

  const podeDesfazer = podeDesfazerPagamento(c, { status: c.contratoStatus, canceladoEm: c.contratoCanceladoEm })

  const mensagem = mensagemCobranca(
    { nome: c.lead.nome_contato, rotulo: c.rotulo, valorCentavos: c.valor_centavos, vencimento: c.vencimento },
    hoje,
  )

  // Quando a tela é atualizada e a cobrança já vem paga, volta o cartão normal (que também tem "Desfazer").
  if (recemPago !== null && c.status !== 'paga') {
    return (
      <article className="rounded-xl border border-emerald-300 bg-white p-4 shadow-sm" aria-busy={pendente}>
        <p className="truncate text-base font-semibold text-marinho">{c.lead.nome_contato}</p>
        <p className="text-sm text-slate-600">{c.rotulo}</p>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 p-2" role="status">
          <p className="text-sm font-medium text-emerald-800">Recebido · {formatarReais(recemPago)}</p>
          <button
            type="button"
            disabled={pendente}
            onClick={desfazer}
            className={`${botaoBase} border border-slate-300 bg-white text-slate-700`}
          >
            Desfazer
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {erro}
          </p>
        )}
      </article>
    )
  }

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${atrasada ? 'border-laranja' : 'border-slate-200'} ${pendente ? 'opacity-70' : ''}`}
      aria-busy={pendente}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/leads/${c.lead.id}`} className="block truncate text-base font-semibold text-marinho hover:underline">
            {c.lead.nome_contato}
          </Link>
          <p className="text-sm text-slate-600">{c.rotulo}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${selo.classe}`}>{selo.texto}</span>
      </div>

      <p className="mt-2 text-lg font-semibold text-slate-900">{formatarReais(c.valor_centavos)}</p>
      {c.status === 'paga' ? (
        <p className="text-sm text-emerald-800">
          Pago em {formatarDataBR(c.pago_em ?? c.vencimento).slice(0, 5)} · {formatarReais(c.valor_pago_centavos ?? c.valor_centavos)}
        </p>
      ) : (
        <p className={`text-sm ${atrasada ? 'font-medium text-laranja' : 'text-slate-600'}`}>
          {atrasada ? 'Venceu' : 'Vence'} {formatarDataBR(c.vencimento).slice(0, 5)}
        </p>
      )}

      {aberta && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() => receber()}
            className={`${botaoBase} col-span-2 bg-marinho text-white`}
          >
            Recebido
          </button>
          <button
            type="button"
            disabled={pendente}
            aria-expanded={painel === 'outro'}
            onClick={() => alternar('outro')}
            className={`${botaoBase} border border-marinho text-marinho`}
          >
            Outro valor/data
          </button>
          <a
            href={linkWhatsApp(c.lead.whatsapp, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botaoBase} bg-laranja text-white`}
          >
            <MessageCircle size={18} aria-hidden /> WhatsApp
          </a>
        </div>
      )}

      {c.status === 'paga' && podeDesfazer && (
        <div className="mt-3">
          <button
            type="button"
            disabled={pendente}
            onClick={desfazer}
            className={`${botaoBase} w-full border border-slate-300 text-slate-700`}
          >
            Desfazer
          </button>
        </div>
      )}

      {permitirEdicao && naoPaga && (
        <button
          type="button"
          disabled={pendente}
          aria-expanded={painel === 'editar'}
          onClick={() => alternar('editar')}
          className={`${botaoBase} mt-2 w-full border border-slate-300 text-slate-700`}
        >
          Editar vencimento/valor
        </button>
      )}

      {painel === 'outro' && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm text-slate-700">
            Data do pagamento
            <input type="date" value={dataPago} onChange={(e) => setDataPago(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm text-slate-700">
            Valor recebido (R$)
            <input type="text" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} className={campo} />
          </label>
          <button
            type="button"
            disabled={pendente}
            onClick={() => receber(dataPago, valorPago)}
            className={`${botaoBase} w-full bg-marinho text-white`}
          >
            Confirmar recebimento
          </button>
        </div>
      )}

      {painel === 'editar' && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm text-slate-700">
            Vencimento
            <input type="date" value={vencimentoEd} onChange={(e) => setVencimentoEd(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm text-slate-700">
            Valor (R$)
            <input type="text" inputMode="decimal" value={valorEd} onChange={(e) => setValorEd(e.target.value)} className={campo} />
          </label>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => acaoEditarCobranca(c.id, vencimentoEd, valorEd))}
            className={`${botaoBase} w-full bg-marinho text-white`}
          >
            Salvar
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {erro}
        </p>
      )}
    </article>
  )
}
