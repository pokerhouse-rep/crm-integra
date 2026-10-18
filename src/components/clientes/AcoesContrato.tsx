'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { StatusContrato } from '@/lib/dominio/tipos'
import { acaoCancelarContrato, acaoPausarContrato, acaoReativarContrato } from '@/app/(app)/clientes/actions'

type Acao = 'pausar' | 'reativar' | 'cancelar'

const TEXTOS: Record<Acao, { titulo: string; confirmar: string; corpo: string[] }> = {
  pausar: {
    titulo: 'Pausar contrato',
    confirmar: 'Pausar',
    corpo: [
      'As cobranças não pagas com vencimento de hoje em diante ficam suspensas e deixam de aparecer como a receber.',
      'Os meses criados durante a pausa também nascem suspensos. Cobranças pagas ou já vencidas não mudam.',
    ],
  },
  reativar: {
    titulo: 'Reativar contrato',
    confirmar: 'Reativar',
    corpo: [
      'Parcelas e valores à vista suspensos voltam a abertos, com a data original (podem aparecer como atrasados; edite a data se precisar).',
      'Mensalidades suspensas só voltam se vencerem de hoje em diante: os meses em que o contrato ficou pausado não são cobrados.',
    ],
  },
  cancelar: {
    titulo: 'Cancelar contrato',
    confirmar: 'Cancelar contrato',
    corpo: [
      'As cobranças não pagas (abertas ou suspensas) com vencimento de hoje em diante são apagadas. Cobranças pagas e vencidas ficam.',
      'Isso não pode ser desfeito.',
    ],
  },
}

const TEXTO_CANCELAR_PAUSADO =
  'Como o contrato está pausado: parcelas e valores à vista suspensos já vencidos voltam a abertos (continuam devidos); mensalidades suspensas já vencidas são apagadas, pois os meses pausados não são cobrados.'

export function AcoesContrato({ contratoId, status }: { contratoId: string; status: StatusContrato }) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)
  const pendenteRef = useRef(pendente)
  useEffect(() => {
    pendenteRef.current = pendente
  })
  useEffect(() => {
    if (!acao) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pendenteRef.current) setAcao(null)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [acao])

  if (status === 'cancelado') return null

  function abrir(a: Acao) {
    setErro(null)
    setAcao(a)
  }

  function confirmar() {
    if (!acao || ocupado.current) return
    ocupado.current = true
    setErro(null)
    const fazer = { pausar: acaoPausarContrato, reativar: acaoReativarContrato, cancelar: acaoCancelarContrato }[acao]
    iniciar(async () => {
      try {
        const r = await fazer(contratoId)
        if (r.erro) setErro(r.erro)
        else setAcao(null)
      } finally {
        ocupado.current = false
      }
    })
  }

  const botao =
    'min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'
  const texto = acao ? TEXTOS[acao] : null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === 'ativo' && (
          <button type="button" onClick={() => abrir('pausar')} className={`${botao} border border-marinho text-marinho`}>
            Pausar
          </button>
        )}
        {status === 'pausado' && (
          <button type="button" onClick={() => abrir('reativar')} className={`${botao} bg-marinho text-white`}>
            Reativar
          </button>
        )}
        <button type="button" onClick={() => abrir('cancelar')} className={`${botao} border border-laranja text-laranja`}>
          Cancelar contrato
        </button>
      </div>

      {acao && texto && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pendente) setAcao(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-acao-contrato"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 md:max-w-lg md:rounded-2xl"
          >
            <h2 id="titulo-acao-contrato" className="text-lg font-semibold text-marinho">
              {texto.titulo}
            </h2>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {texto.corpo.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {acao === 'cancelar' && status === 'pausado' && <p>{TEXTO_CANCELAR_PAUSADO}</p>}
            </div>
            {erro && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {erro}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pendente}
                onClick={() => setAcao(null)}
                className={`${botao} border border-slate-300 text-slate-700`}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={confirmar}
                className={`${botao} ${acao === 'cancelar' ? 'bg-laranja' : 'bg-marinho'} text-white`}
              >
                {texto.confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
