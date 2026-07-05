export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bunker-vignette">
      <div className="text-center">
        <p className="text-stencil text-gold text-sm">SETOR NÃO ENCONTRADO</p>
        <h1 className="mt-2 font-display text-6xl text-foreground">404</h1>
        <a href="/#/" className="mt-6 inline-block text-sm text-gold underline">
          Voltar ao bunker
        </a>
      </div>
    </div>
  );
}
