import { describe, it, expect } from 'vitest'
import { preencherModelo, linkWhatsApp } from '@/lib/dominio/mensagens'

describe('mensagens', () => {
  it('preenche variáveis', () => {
    expect(preencherModelo('Oi {nome}, veja {link_mvp}', { nome: 'Ana', link_mvp: 'https://x.dev' }))
      .toBe('Oi Ana, veja https://x.dev')
  })
  it('variável nula ou ausente vira vazio', () => {
    expect(preencherModelo('Oi {nome} {empresa}', { nome: 'Ana', empresa: null })).toBe('Oi Ana ')
    expect(preencherModelo('Oi {cidade}.', {})).toBe('Oi .')
  })
  it('chave desconhecida fica como está', () => {
    expect(preencherModelo('{desconhecida}', {})).toBe('{desconhecida}')
  })
  it('monta link do WhatsApp', () => {
    expect(linkWhatsApp('5563999990000', 'Olá, tudo bem?'))
      .toBe('https://wa.me/5563999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F')
  })
})
