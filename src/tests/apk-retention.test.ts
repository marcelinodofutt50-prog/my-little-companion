import { describe, expect, it } from "vitest";
import {
  APK_GRACE_AFTER_DOWNLOAD_MS,
  APK_MAX_KEEP_MS,
  computePurgeAfter,
  isPurgeDue,
} from "@/lib/apk-retention";
import { purgeExpiredApkJobs, dropApkSource } from "@/lib/apk-retention.server";

const iso = (ms: number) => new Date(ms).toISOString();
const NOW = new Date("2026-09-15T12:00:00.000Z");
const t = NOW.getTime();

function fakeAdmin(rows: any[]) {
  const removed: Record<string, string[]> = {};
  const updates: any[] = [];
  const admin: any = {
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          removed[bucket] = [...(removed[bucket] ?? []), ...paths];
          return { data: null, error: null };
        },
      }),
    },
    from: () => {
      const q: any = {
        _rows: rows,
        select: () => q,
        is: () => q,
        eq: (_c: string, v: string) => {
          q._single = rows.find((r) => r.id === v) ?? null;
          return q;
        },
        in: (_c: string, ids: string[]) => {
          updates.push({ ...q._payload, ids });
          return Promise.resolve({ data: null, error: null });
        },
        order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }),
        maybeSingle: () => Promise.resolve({ data: q._single, error: null }),
        update: (payload: any) => {
          q._payload = payload;
          return q;
        },
        then: (res: any) => res({ data: null, error: null }),
      };
      return q;
    },
  };
  return { admin, removed, updates };
}

describe("regras de retenção de APK", () => {
  it("sem download, o prazo é o limite máximo de 7 dias", () => {
    const job = { status: "done", completed_at: iso(t) };
    expect(computePurgeAfter(job, NOW)).toBe(iso(t + APK_MAX_KEEP_MS));
  });

  it("após o download, o prazo cai para 48 horas", () => {
    const job = { status: "done", completed_at: iso(t), downloaded_at: iso(t) };
    expect(computePurgeAfter(job, NOW)).toBe(iso(t + APK_GRACE_AFTER_DOWNLOAD_MS));
  });

  it("o download não estende além do limite máximo", () => {
    const done = t - APK_MAX_KEEP_MS + 60_000; // falta 1 minuto para o limite
    const job = { status: "done", completed_at: iso(done), downloaded_at: iso(t) };
    expect(computePurgeAfter(job, NOW)).toBe(iso(done + APK_MAX_KEEP_MS));
  });

  it("job baixado há mais de 48h está vencido", () => {
    const job = {
      status: "done",
      completed_at: iso(t - 3 * 86400000),
      downloaded_at: iso(t - 3 * 86400000),
    };
    expect(isPurgeDue(job, NOW)).toBe(true);
  });

  it("job recém-concluído e ainda não baixado é preservado", () => {
    const job = { status: "done", completed_at: iso(t - 3600_000) };
    expect(isPurgeDue(job, NOW)).toBe(false);
  });

  it("job em atendimento nunca é apagado", () => {
    const job = { status: "processing", created_at: iso(t - 3600_000), purge_after: iso(t - 10) };
    expect(isPurgeDue(job, NOW)).toBe(false);
  });

  it("job travado há mais de 7 dias é apagado mesmo em atendimento", () => {
    const job = { status: "processing", created_at: iso(t - 10 * 86400000) };
    expect(isPurgeDue(job, NOW)).toBe(true);
  });

  it("job já descartado não é reprocessado", () => {
    const job = { status: "done", completed_at: iso(t - 30 * 86400000), purged_at: iso(t) };
    expect(isPurgeDue(job, NOW)).toBe(false);
  });
});

describe("varredura de descarte", () => {
  it("apaga os arquivos vencidos dos dois buckets e marca o registro", async () => {
    const rows = [
      {
        id: "a",
        status: "done",
        created_at: iso(t - 10 * 86400000),
        completed_at: iso(t - 10 * 86400000),
        source_path: "u/a/in.apk",
        result_path: "u/a/out.apk",
      },
      {
        id: "b",
        status: "done",
        created_at: iso(t - 3600_000),
        completed_at: iso(t - 3600_000),
        source_path: "u/b/in.apk",
        result_path: "u/b/out.apk",
      },
    ];
    const { admin, removed, updates } = fakeAdmin(rows);
    const res = await purgeExpiredApkJobs(admin, NOW);
    expect(res.purged).toBe(1);
    expect(removed["apk-uploads"]).toEqual(["u/a/in.apk"]);
    expect(removed["apk-results"]).toEqual(["u/a/out.apk"]);
    expect(updates.at(-1).ids).toEqual(["a"]);
    expect(updates.at(-1).purged_at).toBeTruthy();
  });

  it("descarta o APK original assim que o job termina", async () => {
    const rows = [{ id: "a", source_path: "u/a/in.apk" }];
    const { admin, removed } = fakeAdmin(rows);
    const res = await dropApkSource(admin, "a");
    expect(res.removed).toBe(1);
    expect(removed["apk-uploads"]).toEqual(["u/a/in.apk"]);
  });

  it("não quebra quando o job não tem arquivo de origem", async () => {
    const { admin, removed } = fakeAdmin([{ id: "a", source_path: "" }]);
    const res = await dropApkSource(admin, "a");
    expect(res.removed).toBe(0);
    expect(removed["apk-uploads"]).toBeUndefined();
  });
});
