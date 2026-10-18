"""Gera os icones do PWA a partir da logo (fundo branco, margem de 10% para maskable).
Uso: python -I scripts/gerar-icones.py"""
from PIL import Image

logo = Image.open("docs/assets/logo-integra-sistemas.png").convert("RGBA")
for nome, tam in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)]:
    area = int(tam * 0.8)
    esc = min(area / logo.width, area / logo.height)
    l = logo.resize((round(logo.width * esc), round(logo.height * esc)), Image.LANCZOS)
    fundo = Image.new("RGB", (tam, tam), "white")
    fundo.paste(l, ((tam - l.width) // 2, (tam - l.height) // 2), l)
    fundo.save(f"public/icons/{nome}.png", optimize=True)
