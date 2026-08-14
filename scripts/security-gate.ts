/**
 * Portão de segurança executado automaticamente em CADA deploy (Vercel roda
 * `bun run build`, que chama este script).
 *
 * 1. Executa a suíte E2E de segurança + a verificação automática pós-login
 *    (licença no painel, Staff Nexus e Centro de Treinamento após refresh).
 * 2. Gera um relatório legível em `reports/security-e2e-latest.md`
 *    (+ cópia com carimbo de data e JSON bruto).
 * 3. Falha o build se qualquer teste quebrar.
 *
 * Se as credenciais do banco de produção não estiverem presentes no ambiente
 * do build, o portão apenas avisa e libera — assim o deploy não quebra por
 * falta de secret, mas o relatório registra que não houve verificação.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

const SUITES = ["src/tests/prod-e2e-security.test.ts", "src/tests/post-login-verification.test.ts"];
const REPORT_DIR = "reports";
const RAW = `${REPORT_DIR}/security-e2e-latest.json`;

const hasCreds = Boolean(
  (process.env.EXT_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
);

mkdirSync(REPORT_DIR, { recursive: true });

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");

function writeReport(body: string) {
  writeFileSync(`${REPORT_DIR}/security-e2e-latest.md`, body);
  writeFileSync(`${REPORT_DIR}/security-e2e-${stamp}.md`, body);
}

if (!hasCreds) {
  const body = `# Relatório de segurança do deploy\n\n- Data: ${startedAt.toISOString()}\n- Status: **NÃO EXECUTADO** (credenciais do banco de produção ausentes no ambiente de build)\n\nConfigure \`SUPABASE_URL\`/\`SUPABASE_SERVICE_ROLE_KEY\` (ou os equivalentes \`EXT_*\`) nas variáveis do projeto para que a suíte rode em todo deploy.\n`;
  writeReport(body);
  console.warn("[security-gate] credenciais ausentes — suíte pulada, deploy liberado.");
  process.exit(0);
}

if (existsSync(RAW)) rmSync(RAW);

console.log("[security-gate] executando suíte E2E de segurança...");
const run = spawnSync(
  "bunx",
  ["vitest", "run", ...SUITES, "--reporter=default", "--reporter=json", `--outputFile.json=${RAW}`],
  { stdio: "inherit", env: process.env },
);

type VitestJson = {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: {
    name: string;
    assertionResults: { fullName: string; status: string; failureMessages?: string[] }[];
  }[];
};

let parsed: VitestJson | null = null;
try {
  parsed = JSON.parse(readFileSync(RAW, "utf8")) as VitestJson;
} catch {
  parsed = null;
}

const durationMs = Date.now() - startedAt.getTime();
const failed = run.status !== 0;

const lines: string[] = [];
lines.push("# Relatório de segurança do deploy — ShadowDash Store");
lines.push("");
lines.push(`- Data: ${startedAt.toISOString()}`);
lines.push(`- Duração: ${(durationMs / 1000).toFixed(1)}s`);
lines.push(`- Banco verificado: ${(process.env.EXT_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/https?:\/\//, "")}`);
lines.push(`- Commit: ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local"}`);
lines.push(`- Resultado: ${failed ? "❌ FALHOU — deploy bloqueado" : "✅ APROVADO"}`);
lines.push("");

if (parsed) {
  lines.push(
    `**${parsed.numPassedTests}/${parsed.numTotalTests} testes aprovados** (${parsed.numFailedTests} falhas).`,
  );
  lines.push("");
  for (const file of parsed.testResults) {
    const short = file.name.split("/").pop();
    const pass = file.assertionResults.filter((a) => a.status === "passed").length;
    lines.push(`## ${short} — ${pass}/${file.assertionResults.length}`);
    lines.push("");
    for (const test of file.assertionResults) {
      const icon = test.status === "passed" ? "✅" : test.status === "failed" ? "❌" : "⏭️";
      lines.push(`- ${icon} ${test.fullName}`);
      if (test.status === "failed" && test.failureMessages?.length) {
        lines.push(`  - \`${test.failureMessages[0]!.split("\n")[0]}\``);
      }
    }
    lines.push("");
  }
} else {
  lines.push("Não foi possível ler a saída JSON do vitest; veja o log do build.");
  lines.push("");
}

lines.push("---");
lines.push(
  "Cobertura: RLS e bloqueio de anônimos, autorização do Staff Nexus, validação de uploads, índices anti-abuso (1 trial e 1 APK por aparelho), detecção de conduta inadequada e verificação pós-login (licença no painel, Centro de Treinamento e Staff Nexus após refresh).",
);

writeReport(lines.join("\n"));
console.log(`[security-gate] relatório em ${REPORT_DIR}/security-e2e-latest.md`);

if (failed) {
  console.error("[security-gate] suíte de segurança falhou — abortando o deploy.");
  process.exit(1);
}
