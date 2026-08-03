export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Shadow — Erro de Sistema</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { --primary: #2563eb; --neon: #84fd94; --background: #090e1a; }
      body { 
        font-family: 'JetBrains Mono', ui-monospace, monospace; 
        background: var(--background); 
        color: #fff; 
        display: grid; 
        place-items: center; 
        min-height: 100vh; 
        margin: 0; 
        padding: 1.5rem;
        background-image: 
          radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.1), transparent 50%),
          repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,0.2) 3px 4px);
      }
      .card { 
        max-width: 28rem; 
        width: 100%; 
        text-align: center; 
        padding: 2.5rem; 
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(13, 19, 33, 0.8);
        backdrop-filter: blur(10px);
        border-radius: 8px;
      }
      h1 { font-size: 1.5rem; margin: 0 0 1rem; color: var(--neon); text-transform: uppercase; letter-spacing: 0.2em; }
      p { color: #94a3b8; margin: 0 0 2rem; font-size: 0.9rem; }
      .actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
      a, button { 
        padding: 0.75rem 1.5rem; 
        border-radius: 4px; 
        font-size: 0.7rem;
        font-weight: bold;
        cursor: pointer; 
        text-decoration: none; 
        border: 1px solid transparent; 
        text-transform: uppercase;
        letter-spacing: 0.1em;
        transition: all 0.3s;
      }
      .primary { background: var(--primary); color: #fff; box-shadow: 0 0 15px rgba(37, 99, 235, 0.3); }
      .primary:hover { opacity: 0.9; transform: translateY(-1px); }
      .secondary { background: transparent; color: #94a3b8; border-color: rgba(255,255,255,0.1); }
      .secondary:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
      .code { font-size: 0.6rem; color: #475569; margin-top: 2rem; opacity: 0.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>System Error</h1>
      <p>Ocorreu uma falha crítica na inicialização dos módulos. Isso geralmente acontece devido ao cache do navegador ou instabilidade na rede.</p>
      <div class="actions">
        <button class="primary" onclick="caches.keys().then(names => { for (let name of names) caches.delete(name); }).finally(() => { location.reload(true); })">Limpar Cache & Recarregar</button>
        <a class="secondary" href="/">Voltar ao Início</a>
      </div>
      <div class="code">// runtime_exception_caught</div>
    </div>
  </body>
</html>`;
}
