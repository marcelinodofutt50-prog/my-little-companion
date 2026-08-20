CREATE TABLE IF NOT EXISTS public.staff_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'onboarding',
  level text NOT NULL DEFAULT 'basico',
  video_url text,
  estimated_minutes integer NOT NULL DEFAULT 10,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_trainings TO authenticated;
GRANT ALL ON public.staff_trainings TO service_role;

ALTER TABLE public.staff_trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read internal trainings" ON public.staff_trainings;
CREATE POLICY "Staff can read internal trainings"
  ON public.staff_trainings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage internal trainings" ON public.staff_trainings;
CREATE POLICY "Admins manage internal trainings"
  ON public.staff_trainings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_staff_trainings_updated ON public.staff_trainings;
CREATE TRIGGER trg_staff_trainings_updated
  BEFORE UPDATE ON public.staff_trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.staff_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  training_id uuid NOT NULL REFERENCES public.staff_trainings(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, training_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_training_progress TO authenticated;
GRANT ALL ON public.staff_training_progress TO service_role;

ALTER TABLE public.staff_training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own training progress" ON public.staff_training_progress;
CREATE POLICY "Staff read own training progress"
  ON public.staff_training_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff write own training progress" ON public.staff_training_progress;
CREATE POLICY "Staff write own training progress"
  ON public.staff_training_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update own training progress" ON public.staff_training_progress;
CREATE POLICY "Staff update own training progress"
  ON public.staff_training_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_staff_training_progress_updated ON public.staff_training_progress;
CREATE TRIGGER trg_staff_training_progress_updated
  BEFORE UPDATE ON public.staff_training_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.staff_trainings (title, description, content, category, level, estimated_minutes, display_order)
SELECT * FROM (VALUES
  ('Boas-vindas à equipe Shadow', 'Como funciona a operação, canais internos e o que se espera de cada cargo.', E'## Bem-vindo(a)\n\nVocê agora faz parte da equipe Shadow. Este módulo cobre o básico:\n\n- Canais internos (Staff Nexus) e quando usar cada um.\n- Cargos: admin, moderação e suporte — o que cada um pode fazer.\n- Horários de cobertura e como avisar ausência.\n\n### Regras de ouro\n1. Nunca compartilhe dados de clientes fora dos canais internos.\n2. Nunca prometa prazo que a operação não pode cumprir.\n3. Em dúvida, escale para um admin no canal #suporte.', 'onboarding', 'basico', 8, 1),
  ('Atendimento no chat ao vivo', 'Tom de voz, tempo de resposta, uso do resumo de atendimento e encaminhamentos.', E'## Padrão de atendimento\n\n- Responda em até 5 minutos no horário de cobertura.\n- Sempre confirme o problema com as próprias palavras antes de agir.\n- Use o resumo estruturado: diagnóstico, evidências, protocolo e próximos passos.\n\n### Encaminhamento\nQuando houver bloqueio de sistema ou erro técnico, encaminhe para suporte com o protocolo do atendimento.', 'suporte', 'basico', 12, 2),
  ('Licenças: gerar, renovar e revogar', 'Fluxo completo de licenças, cotas de geração manual e o que fazer quando a licença não sai na hora.', E'## Licenças\n\n- Compra aprovada gera licença automaticamente; a reconciliação roda periodicamente.\n- Geração manual tem cota diária e mensal por atendente.\n- Antes de gerar manual, confirme o pagamento no painel.\n\n### Quando a licença não aparece\n1. Confira o pagamento.\n2. Rode a reconciliação.\n3. Só então gere manualmente e registre o motivo.', 'licencas', 'intermediario', 15, 3),
  ('Antifraude e teste grátis', 'Como o sistema avalia risco e como tratar casos ambíguos sem punir cliente legítimo.', E'## Antifraude\n\nO sistema avalia IP, aparelho, idade da conta e histórico de tentativas negadas.\n\n### Regra principal\nSó revogue com evidência inequívoca (relato direto de instalação em terceiros).\nCaso ambíguo vai para revisão — nunca bloqueie por suspeita solta.\n\n### Ao comunicar bloqueio\nExplique o motivo em linguagem simples e ofereça o caminho da compra.', 'seguranca', 'intermediario', 14, 4),
  ('Segurança e privacidade da operação', 'Boas práticas com credenciais, dados de clientes e acesso ao painel.', E'## Segurança\n\n- Nunca reutilize senha do painel em outros serviços.\n- Não exporte listas de clientes.\n- Chaves e segredos ficam apenas no servidor — jamais em prints ou mensagens.\n- Ao sair do turno, encerre a sessão em máquinas compartilhadas.', 'seguranca', 'avancado', 10, 5)
) AS seed(title, description, content, category, level, estimated_minutes, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.staff_trainings);