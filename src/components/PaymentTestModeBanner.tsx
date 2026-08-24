const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-danger/40 bg-danger/10 px-4 py-2 text-center font-mono text-[11px] text-danger">
        Pagamentos ainda não estão ativados nesta versão do site.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center font-mono text-[11px] text-amber-400">
        Ambiente de teste — nenhum valor real é cobrado.
      </div>
    );
  }
  return null;
}
