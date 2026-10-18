export const VARIAVEIS_MODELO = ['nome', 'empresa', 'link_mvp', 'cidade'] as const

/**
 * Troca {chave} pelas variáveis suportadas. Variável suportada ausente ou nula
 * vira ''; chave desconhecida fica como está.
 */
export function preencherModelo(
  texto: string,
  vars: Record<string, string | null | undefined>,
): string {
  return texto.replace(/\{(\w+)\}/g, (original, chave: string) => {
    if (!(VARIAVEIS_MODELO as readonly string[]).includes(chave)) return original
    return vars[chave] ?? ''
  })
}

export function linkWhatsApp(telefoneNormalizado: string, texto: string): string {
  return `https://wa.me/${telefoneNormalizado}?text=${encodeURIComponent(texto)}`
}
