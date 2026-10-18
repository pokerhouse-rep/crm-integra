'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

export default function ErroApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-md">
      <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-marinho">Algo deu errado.</h1>
        <p className="mt-2 text-sm text-slate-600">Verifique se o banco local (Docker) está ligado.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-laranja px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            <RotateCcw size={16} aria-hidden /> Tentar de novo
          </button>
          <Link
            href="/hoje"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-medium text-marinho focus-visible:outline-2 focus-visible:outline-azul"
          >
            Ir para Hoje
          </Link>
        </div>
      </div>
    </div>
  )
}
