'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { mensagemCobranca, situacaoCobranca } from '@/lib/dominio/cobrancas'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { formatarReais, reaisParaCampo } from '@/lib/dominio/dinheiro'
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

const botaoBase =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
const campo = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base'

export function CartaoCobranca({ cobranca: c, hoje, diasLembrete, permitirEdicao = false }: Props) {
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState<'outro' | 'editar' | null>(null)
  const [data, setData] = useState<string>(hoje)
  const [valor, setValor] = useState(reaisParaCampo(c.valor_centavos))
  const [vencimento, setVencimento] = useState<string>(c.vencimento)

  const situacao = situacaoCobranca(c, hoje, diasLembrete)
  const selo = SELO[situacao]
  const atrasada = situacao === 'atrasada'
  const aberta = c.status === 'aberta'
  const naoPaga = c.status !== 'paga'

  function rodar(acao: () => Promise<{ erro?: string }>) {
    if (ocupado.current) return
    ocupado.current = true
    setErro(null)
    iniciar(async () => {
      try {
        const r = await acao()
        if (r.erro) setErro(r.erro)
        else setPainel(null)
      } finally {
        ocupado.current = false
      }
    })
  }

  const mensagem = mensagemCobranca(
    { nome: c.lead.nome_contato, rotulo: c.rotulo, valorCentavos: c.valor_centavos, vencimento: c.vencimento },
    hoje,
  )

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
            onClick={() => rodar(() => acaoMarcarPago(c.id))}
            className={`${botaoBase} col-span-2 bg-marinho text-white`}
          >
            Recebido
          </button>
          <button
            type="button"
            disabled={pendente}
            aria-expanded={painel === 'outro'}
            onClick={() => setPainel(painel === 'outro' ? null : 'outro')}
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

      {c.status === 'paga' && (
        <div className="mt-3">
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => acaoDesfazerPagamento(c.id))}
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
          onClick={() => setPainel(painel === 'editar' ? null : 'editar')}
          className={`${botaoBase} mt-2 w-full border border-slate-300 text-slate-700`}
        >
          Editar vencimento/valor
        </button>
      )}

      {painel === 'outro' && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm text-slate-700">
            Data do pagamento
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm text-slate-700">
            Valor recebido (R$)
            <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={campo} />
          </label>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => acaoMarcarPago(c.id, data, valor))}
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
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm text-slate-700">
            Valor (R$)
            <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={campo} />
          </label>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => acaoEditarCobranca(c.id, vencimento, valor))}
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
