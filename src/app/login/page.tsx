'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { entrar, type EstadoLogin } from './actions'

const inicial: EstadoLogin = { erro: null }

export default function LoginPage() {
  const [estado, acao, pendente] = useActionState(entrar, inicial)

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        action={acao}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Integra Sistemas" width={200} height={80} priority className="h-auto w-48" />
        </div>
        <label className="block text-sm font-medium text-slate-700">
          E-mail
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-marinho focus:outline-none focus:ring-2 focus:ring-azul"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Senha
          <input
            name="senha"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-marinho focus:outline-none focus:ring-2 focus:ring-azul"
          />
        </label>
        {estado.erro && (
          <p role="alert" className="text-sm text-red-600">
            {estado.erro}
          </p>
        )}
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 w-full rounded-lg bg-laranja px-4 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}