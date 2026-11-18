import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLifetimeLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("licenses")
      .select("id")
      .eq("user_id", context.userId)
      .eq("plan_slug", "login-lifetime")
      .eq("is_trial", false)
      .is("disabled_at", null)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Não foi possível verificar sua licença.");
    if (!data) return null;

    return [
      {
        title: "Proteção da conta com 2FA",
        steps: [
          "Abra as configurações de segurança da sua conta e selecione a opção de autenticação em dois fatores.",
          "Vincule seu aplicativo autenticador e use o código gerado para concluir a ativação.",
          "Guarde os códigos de recuperação, caso sejam oferecidos, em um local seguro. Nunca envie esses códigos pelo chat.",
        ],
      },
      {
        title: "Licenças e renovação de servidor",
        steps: [
          "No painel, confira qual login está vinculado à sua licença e consulte a validade do servidor.",
          "Em Renovar servidor, escolha o login desejado e confira o valor antes de pagar.",
          "Se o checkout indicar confirmação manual, abra um ticket com o número do pedido e o comprovante. Depois, confira a nova validade no painel.",
        ],
      },
      {
        title: "Diagnóstico de problemas de acesso",
        steps: [
          "Confira se a mensagem indica um problema de autenticação ou um servidor com validade vencida.",
          "Se necessário, use a opção oficial de recuperação de conta e verifique se está entrando com o login vinculado.",
          "Se precisar de suporte, envie a mensagem de erro e o horário aproximado pelo ticket. Oculte senhas e códigos de autenticação.",
        ],
      },
    ];
  });
