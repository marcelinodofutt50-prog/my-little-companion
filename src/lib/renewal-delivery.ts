type Result = { Success?: unknown; Fail?: unknown };
/** Do not save active access or declare fulfillment until both panel operations succeed. */
export async function deliverServerRenewal(steps: {
  paused: boolean;
  extend: () => Promise<Result>;
  applyPassword: () => Promise<Result>;
  save: () => Promise<void>;
}) {
  if (!steps.paused) {
    const extension = await steps.extend();
    if (extension.Fail || !extension.Success) throw new Error("Painel não confirmou a validade.");
    const password = await steps.applyPassword();
    if (password.Fail || !password.Success) throw new Error("Painel não confirmou a senha do login.");
  }
  await steps.save();
}