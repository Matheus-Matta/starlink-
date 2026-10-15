export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground mt-2">O endereço não existe ou o link está indisponível.</p>
      </div>
    </main>
  );
}
