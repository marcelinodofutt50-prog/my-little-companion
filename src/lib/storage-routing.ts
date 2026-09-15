/**
 * Roteamento de arquivos entre os dois projetos de armazenamento.
 *
 * O projeto principal guarda os dados (contas, licenças, suporte). Os arquivos
 * novos vão para um segundo projeto, só de arquivos, para não consumir a cota
 * de tráfego do principal. Arquivos antigos continuam no projeto principal e
 * são reconhecidos por não terem o prefixo abaixo.
 */
export const SECONDARY_PREFIX = "s2/";

export function isSecondaryPath(path: string | null | undefined): boolean {
  return typeof path === "string" && path.startsWith(SECONDARY_PREFIX);
}

/** Marca um caminho novo como pertencente ao projeto de arquivos. */
export function withSecondaryPrefix(path: string): string {
  const clean = String(path ?? "").replace(/^\/+/, "");
  return isSecondaryPath(clean) ? clean : `${SECONDARY_PREFIX}${clean}`;
}

/** Remove o prefixo — útil para exibir o nome original em telas administrativas. */
export function stripSecondaryPrefix(path: string): string {
  return isSecondaryPath(path) ? path.slice(SECONDARY_PREFIX.length) : path;
}

/** Separa uma lista de caminhos entre os dois projetos. */
export function splitByProject(paths: Array<string | null | undefined>): {
  secondary: string[];
  primary: string[];
} {
  const secondary: string[] = [];
  const primary: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (isSecondaryPath(p)) secondary.push(p);
    else primary.push(p);
  }
  return { secondary, primary };
}
