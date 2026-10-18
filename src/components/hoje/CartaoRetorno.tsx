'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, MessageCircle } from 'lucide-react'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import type { Resultado } from '@/lib/dominio/tipos'
import { acaoResultado } from '@/app/(app)/hoje/actions'
import { DialogoMotivoPerda } from '@/components/leads/DialogoMotivoPerda'
import { SeletorNovaData } from './SeletorNovaData'

export interface DadosCartaoRetorno {
  retornoId: string
  leadId: string
  nome: string
  empresa: string | null
  nicho: string | null
  linkMvp: string | null
  dataPrevista: DataISO
  atrasado: boolean
  rotuloPasso: string
  frio: boolean
  mensagem: string
  linkWhatsApp: string
}

interface Props {
  dados: DadosCartaoRetorno
  hoje: DataISO
  motivos: { id: string; nome: string }[]
}

const botaoBase =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

export function CartaoRetorno({ dados, hoje, motivos }: Props) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState<'tempo' | 'motivo' | null>(null)
  const [copiado, setCopiado] = useState(false)

  function registrar(resultado: Resultado, novaData?: DataISO, motivoId?: string) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoResultado(dados.retornoId, resultado, novaData, motivoId)
      if (r.erro) setErro(r.erro)
      else setPainel(null)
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(dados.mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Não foi possível copiar. Use o botão do WhatsApp.')
    }
  }

  const subtitulo = [dados.empresa, dados.nicho].filter(Boolean).join(' · ')

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${dados.atrasado ? 'border-laranja' : 'border-slate-200'} ${pendente ? 'opacity-70' : ''}`}
      aria-busy={pendente}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/leads/${dados.leadId}`} className="block truncate text-base font-semibold text-marinho hover:underline">
            {dados.nome}
          </Link>
          {subtitulo && <p className="truncate text-sm text-slate-600">{subtitulo}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{dados.rotuloPasso}</span>
          {dados.frio && (
            <span className="rounded-full bg-azul/15 px-2 py-0.5 font-medium text-marinho">Frio · reativação</span>
          )}
          {dados.atrasado && (
            <span className="rounded-full bg-laranja/15 px-2 py-0.5 font-medium text-laranja">
              Atrasado · {formatarDataBR(dados.dataPrevista).slice(0, 5)}
            </span>
          )}
        </div>
      </div>

      {dados.linkMvp && (
        <a
          href={dados.linkMvp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-azul underline"
        >
          <ExternalLink size={14} aria-hidden /> Ver MVP
        </a>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={dados.linkWhatsApp} target="_blank" rel="noopener noreferrer" className={`${botaoBase} bg-laranja text-white`}>
          <MessageCircle size={18} aria-hidden /> WhatsApp
        </a>
        <button type="button" onClick={copiar} className={`${botaoBase} border border-slate-300 bg-white text-slate-700`}>
          <Copy size={16} aria-hidden /> {copiado ? 'Copiado!' : 'Copiar texto'}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" disabled={pendente} onClick={() => registrar('respondeu')} className={`${botaoBase} bg-marinho text-white`}>
          Respondeu
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPainel(painel === 'tempo' ? null : 'tempo')}
          className={`${botaoBase} border border-marinho text-marinho`}
        >
          Pediu tempo
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPainel('motivo')}
          className={`${botaoBase} border border-slate-300 text-slate-700`}
        >
          Sem interesse
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => registrar('sem_resposta')}
          className={`${botaoBase} border border-slate-300 text-slate-700`}
        >
          Sem resposta
        </button>
      </div>

      {painel === 'tempo' && (
        <SeletorNovaData
          hoje={hoje}
          pendente={pendente}
          onEscolher={(data) => registrar('pediu_tempo', data)}
          onCancelar={() => setPainel(null)}
        />
      )}
      {painel === 'motivo' && (
        <DialogoMotivoPerda
          motivos={motivos}
          pendente={pendente}
          erro={erro ?? undefined}
          onConfirmar={(id) => registrar('sem_interesse', undefined, id)}
          onCancelar={() => {
            setErro(null)
            setPainel(null)
          }}
        />
      )}

      {erro && painel !== 'motivo' && (
        <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
    </article>
  )
}
