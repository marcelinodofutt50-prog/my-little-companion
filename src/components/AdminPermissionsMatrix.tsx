import { Fragment } from "react";
import { Check, Minus, ShieldCheck, LifeBuoy, User } from "lucide-react";
import { MATRIX_ROWS, ROLE_CAPS, ROLE_DESC, ROLE_LABEL, can, type Role } from "@/lib/permissions";

const ROLES: Role[] = ["admin", "moderator", "user"];
const ROLE_ICON = { admin: ShieldCheck, moderator: LifeBuoy, user: User } as const;

export function AdminPermissionsMatrix() {
  return (
    <div className="osint-panel osint-corners p-4">
      <div className="osint-label mb-1">acl // matriz de permissões</div>
      <h3 className="font-display text-sm font-semibold">O que cada papel pode ver e executar</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Esta é a regra oficial da equipe. O painel esconde o que o papel não pode usar, e o servidor
        recusa qualquer ação fora da matriz — mesmo que alguém tente pela mão.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {ROLES.map((r) => {
          const Icon = ROLE_ICON[r];
          return (
            <div key={r} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5 text-neon" /> {ROLE_LABEL[r]}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {ROLE_CAPS[r].length} permissões
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{ROLE_DESC[r]}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">Permissão</th>
              {ROLES.map((r) => (
                <th key={r} className="w-20 py-2 text-center">{ROLE_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((g) => (
              <Fragment key={g.group}>
                <tr className="bg-foreground/[0.03]">
                  <td colSpan={4} className="px-1 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/80">
                    {g.group}
                  </td>
                </tr>
                {g.items.map((it) => (
                  <tr key={it.cap} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{it.label}</div>
                      {it.note && <div className="text-[10px] text-muted-foreground">{it.note}</div>}
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className="py-2 text-center">
                        {can(r, it.cap) ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-neon" aria-label="permitido" />
                        ) : (
                          <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" aria-label="bloqueado" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Regra de ouro: dê <b>Suporte</b> por padrão. <b>Admin</b> só para quem precisa mexer em dinheiro,
        licenças e equipe — toda ação de admin fica registrada na Auditoria.
      </p>
    </div>
  );
}
