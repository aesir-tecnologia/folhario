# Copy & Microcopy — Folhário

**Locale:** pt-BR (MVP). All strings through i18n layer. No hardcoding.
**Voice:** Knowledgeable friend. Warm, never patronizing. No jargon. Second-person (você).

---

## Brand / Core

- App name: **Folhário**
- Tagline (suggestion): "Cuide das suas plantas sem medo."
- Catalog name: **Meu Jardim**

---

## Auth

### Signup
- Title: "Criar conta"
- Subtitle: "Seu jardim começa aqui."
- Email label: "E-mail"
- Password label: "Senha"
- Confirm password: "Confirmar senha"
- Age checkbox: "Tenho 13 anos ou mais."
- Partner code toggle: "Tenho um código de parceiro"
- Partner code field: "Código de parceiro"
- T&C: "Ao criar a conta você aceita os [Termos de Uso] e a [Política de Privacidade]."
- OAuth: "Continuar com Google"
- Submit: "Criar conta"
- Link to login: "Já tem conta? Entrar"

### Signup Errors
- "Esse e-mail já está em uso."
- "Senha muito curta (mínimo 8 caracteres)."
- "As senhas não coincidem."
- "Código de parceiro inválido."
- "Você precisa ter 13 anos ou mais para criar uma conta."
- "Algo deu errado. Tente novamente."

### Login
- Title: "Entrar"
- Email: "E-mail"
- Password: "Senha"
- Submit: "Entrar"
- Forgot: "Esqueci minha senha"
- Link to signup: "Ainda não tem conta? Criar conta"

### Login Errors
- "E-mail ou senha incorretos."
- "Sem conexão. Verifique sua internet."

### Password Recovery
- Title: "Recuperar senha"
- Body: "Digite seu e-mail e enviaremos um link para redefinir sua senha."
- Submit: "Enviar link"
- Confirmation: "Link enviado! Verifique sua caixa de entrada."

---

## Home / Daily Summary

### Empty State
- Headline: "Sua primeira planta está a uma foto de distância."
- CTA button: "Identificar planta"

### Default State
- Section title: "Hoje"
- Empty today: "Nada para hoje. Suas plantas estão em dia."
- Section title: "Notificações recentes"
- Empty notifications: "Nenhuma notificação."
- Quick action: "Identificar planta"
- Nav: "Meu Jardim"

### Read-Only Banner
- "Sua assinatura expirou. Reative para identificar e receber lembretes."
- CTA: "Reativar"

---

## Identify

### Picker
- Title: "Identificar planta"
- Guide heading: "Dicas para uma boa foto"
- Guide items:
  - "Fotografe a folha de perto"
  - "Inclua a flor, se tiver"
  - "Fotografe a planta inteira"
  - "Mais fotos melhoram a precisão"
- Buttons: "Usar câmera" / "Escolher da galeria"
- Submit: "Identificar"

### Loading
- "Identificando sua planta..."
- Subcopy: "Isso pode levar alguns segundos."

### Results
- Title: "Encontramos estas possibilidades"
- Per card: "{confidence}% de confiança"
- Primary action (card): "Selecionar"
- Secondary: "Nenhuma destas — adicionar manualmente"

### No Results / Low Confidence
- Title: "Não conseguimos identificar esta planta."
- Body: "Tente fotografar a folha mais de perto, com boa iluminação, em um fundo neutro."
- Retry: "Tentar de novo"
- Manual: "Adicionar manualmente"

### LGPD Consent Modal (First Identify)
- Title: "Antes de começar"
- Body: "Para identificar plantas, enviamos suas fotos para serviços parceiros (Plant ID e provedores compatíveis com OpenAI). Esses serviços podem estar fora do Brasil. Suas fotos não são usadas para treinar modelos."
- Link: "Saiba mais na Política de Privacidade"
- Accept: "Aceitar e continuar"
- Decline: "Cancelar"

### Cap Reached (Daily)
- Title: "Você atingiu o limite de identificações de hoje"
- Body: "Seu limite reinicia em {time}."
- Link: "Adicionar planta manualmente"

### Cap Reached (Period)
- Title: "Você atingiu o limite de identificações do seu {plano}"
- Body: "Seu limite reinicia em {date}."
- Link: "Adicionar planta manualmente"

### Provider Unavailable
- Title: "Identificação temporariamente indisponível"
- Body: "Estamos resolvendo um problema com nossos parceiros. Tente de novo em alguns minutos."
- Retry: "Tentar de novo"
- Fallback: "Adicionar manualmente"

### Offline
- "Sem conexão. A identificação precisa de internet."
- Subcopy: "Reconecte e tente de novo."

### Read-Only Paywall
- Title: "Sua assinatura expirou"
- Body: "Reative para continuar identificando plantas."
- CTA: "Reativar assinatura"

---

## Add Plant

### From Identification
- Title: "Adicionar ao Meu Jardim"
- Name field (prefilled): "Nome"
- Nickname: "Apelido (opcional)"
- Location: "Onde fica na casa?"
- Date: "Quando você ganhou/comprou?"
- Notes: "Anotações pessoais"
- Submit: "Adicionar planta"
- Cancel: "Cancelar"

### Manual
- Title: "Adicionar planta manualmente"
- Same fields.
- Photo required message: "Adicione pelo menos uma foto."
- Submit: "Adicionar planta"

### Room Field
- Placeholder: "Ex: Sala, varanda, quarto..."
- Suggestions: "Sala", "Varanda", "Quarto", "Banheiro", "Cozinha", "Escritório", "Jardim", "Outro"
- Section titles: "Usados antes" / "Sugestões"

---

## Catalog ("Meu Jardim")

- Title: "Meu Jardim"
- Sort label: "Ordenar por"
- Sort options: "Nome (A-Z)" / "Nome (Z-A)" / "Mais recentes" / "Mais antigas" / "Local"
- Add button: "+ Planta"
- Empty: "Seu jardim está vazio. Que tal identificar sua primeira planta?"

---

## Plant Profile

- Edit button: "Editar"
- Delete button: "Excluir planta"
- Delete confirm title: "Excluir {planta}?"
- Delete confirm body: "Esta ação não pode ser desfeita. Fotos, lembretes e histórico serão removidos."
- Delete confirm actions: "Excluir" / "Cancelar"

- Sections:
  - "Sobre"
  - "Guia de cuidados"
  - "Lembretes"
  - "Diário de fotos"
  - "Histórico de identificação"

- No reminders: "Nenhum lembrete ativo."
- Add reminder CTA: "+ Lembrete"
- No journal: "Nenhuma foto no diário ainda."
- Add journal CTA: "+ Foto no diário"

---

## Care Guide

- Section title: "Guia de cuidados"
- Dimensions:
  - "Rega"
  - "Luz"
  - "Solo"
  - "Temperatura"
  - "Umidade"
  - "Toxicidade"
  - "Dificuldade"
- Seasonal section: "Dicas por estação"
- Compatibility: "Plantas compatíveis"

### Toxicity Badges
- Safe: "Segura para pets e crianças"
- Toxic to pets: "⚠️ Tóxica para pets"
- Toxic to children: "⚠️ Tóxica para crianças"
- Toxic to both: "⚠️ Tóxica para pets e crianças"

### Toxicity Disclaimer (always visible)
- "Informação gerada por IA — confirme com um veterinário."

### First-Ever Care Guide Modal
- Title: "Sobre as informações de toxicidade"
- Body: "As informações de toxicidade são geradas por IA a partir de fontes confiáveis, mas podem ter erros. Em caso de ingestão por pets ou crianças, procure imediatamente um veterinário ou médico."
- Acknowledge: "Entendi"

### Draft Badge
- "Gerado por IA — em revisão"

### Difficulty Levels
- "Fácil" / "Média" / "Difícil"

### Light Levels
- "Sol direto" / "Luz indireta" / "Sombra"

### Humidity Levels
- "Baixa" / "Média" / "Alta"

---

## Reminders

### Create / Edit
- Title (create): "Novo lembrete"
- Title (edit): "Editar lembrete"
- Type label: "Tipo"
- Type options: "Rega" / "Adubação"
- Frequency label: "Frequência"
- Time label: "Horário"
- Advance rule label: "Calcular próxima data a partir de"
- Advance rule options:
  - "Data agendada (ex: toda segunda)"
  - "Data em que marquei como feito (ex: 7 dias após a última rega)"
- Save: "Salvar lembrete"
- Delete: "Excluir lembrete"

### List
- Title: "Lembretes"
- Group heading: "{planta}"
- Entry: "{tipo} • a cada {frequência} • {horário}"
- Next due: "Próximo: {data}"
- Empty: "Nenhum lembrete configurado."

### Push Permission Prompt (in-app primer)
- Title: "Ativar notificações?"
- Body: "Para te avisar na hora certa, precisamos da sua permissão para enviar notificações."
- Confirm: "Ativar notificações"
- Skip: "Agora não"

### Notification Content
- Title: "Hora de cuidar de {planta}"
- Body (water): "Está na hora de regar."
- Body (fertilize): "Está na hora de adubar."
- Actions: "Feito" / "Adiar"

### Snooze Options
- "1 hora" / "3 horas" / "Amanhã"

### Daily Summary (in-app)
- Today: "Hoje"
- Overdue label: "Atrasado"
- Empty: "Tudo em dia! Aproveite o dia."

### Missed Notification Center Entry
- "{planta}: {tipo} — {data/hora}"
- Tap to clear on interaction.

---

## Photo Journal

- Title: "Diário de fotos"
- Add entry title: "Nova foto no diário"
- Note placeholder: "Como ela está hoje? (opcional)"
- Save: "Adicionar ao diário"
- Empty: "Adicione a primeira foto para acompanhar o crescimento."
- Entry timestamp format: Brazilian Portuguese (e.g., "12 de abril de 2026").

---

## Identification History

- Title: "Histórico de identificação"
- Entry format: "{data} • {n} foto(s)"
- Selected result label: "Selecionado: {nome}"
- Manual correction label: "Correção manual: {nome}"
- Failure labels:
  - "Falhou: tempo excedido"
  - "Falhou: serviço indisponível"
  - "Falhou: limite atingido"
- Re-associate action: "Associar a uma planta"
- Empty: "Nenhuma identificação ainda."

---

## Settings

- Title: "Configurações"

### Account Section
- Heading: "Conta"
- Email: "E-mail"
- Password: "Alterar senha"
- Timezone: "Fuso horário"
- Logout: "Sair deste dispositivo"

### Notifications Section
- Heading: "Notificações"
- Global mute: "Silenciar todas as notificações"
- Per-plant: "Silenciar por planta"
- Permission granted: "Notificações ativadas"
- Permission denied: "Notificações desativadas no navegador. Ative nas configurações do seu dispositivo."

### Subscription Section
- Heading: "Assinatura e pagamento"
- Plan line: "Plano: {plano}"
- Status line: "Status: {status}"
- Status values: "Em teste" / "Ativa" / "Pagamento pendente" / "Cancelada" / "Expirada"
- Renewal: "Próxima cobrança: {data}"
- Trial end: "Seu teste termina em {data}"
- Payment method: "Forma de pagamento: {last4 / Pix}"
- Update PM: "Atualizar forma de pagamento"
- Cancel: "Cancelar assinatura"
- Cancel confirm title: "Cancelar assinatura?"
- Cancel confirm body: "Você continuará com acesso completo até {data}. Depois disso, seu jardim ficará em modo somente leitura."
- Cancel confirm actions: "Cancelar assinatura" / "Voltar"
- Reactivate: "Reativar assinatura"
- Billing history: "Histórico de pagamentos"
- Partner code field: "Código de parceiro" (only while trial window open)
- Partner code success: "Código aplicado! Seu teste foi estendido até {data}."
- Partner code error: "Código inválido ou expirado."

### Privacy & LGPD Section
- Heading: "Privacidade e dados"
- Export: "Exportar meus dados"
- Export body: "Baixe uma cópia de tudo que guardamos sobre você em formato JSON."
- Export started: "Seu arquivo será gerado e enviado por e-mail."
- Delete: "Excluir minha conta"
- Delete confirm title: "Excluir sua conta?"
- Delete confirm body: "Sua conta será suspensa por 7 dias. Depois disso, todas as suas plantas, fotos e dados pessoais serão removidos permanentemente. Você pode cancelar a exclusão entrando de novo durante esses 7 dias."
- Delete confirm actions: "Excluir conta" / "Voltar"
- Consents: "Gerenciar consentimentos"
- Consent items:
  - "Envio de fotos para identificação"
  - "Notificações push"
- Privacy policy link: "Política de Privacidade"
- Terms link: "Termos de Uso"
- DPO: "Encarregado de Dados: {nome} — {contato}"

### Needs Attention
- Heading: "Ações pendentes"
- Body: "Algumas ações não foram sincronizadas."
- Retry: "Tentar de novo"
- Discard: "Descartar"

---

## Banners & Global

### Offline Banner
- "Você está offline. Algumas ações serão sincronizadas quando a conexão voltar."

### Read-Only Mode Banner
- "Modo somente leitura. Reative sua assinatura para identificar plantas e receber lembretes."
- CTA: "Reativar"

### Discard Summary Toast (post-sync)
- "{n} ações foram descartadas porque a planta foi excluída."
- Toast action: "Ver detalhes"

### Discard Summary Modal
- Title: "Ações descartadas"
- Body: "As seguintes ações não puderam ser sincronizadas porque a planta foi removida em outro dispositivo:"
- Per-entry: "{tipo} • {planta} • {data/hora original}"
- Dismiss: "Entendi"

### Generic Errors
- "Algo deu errado. Tente novamente."
- "Não foi possível conectar ao servidor."
- "Sessão expirada. Faça login de novo."

### Generic Success
- "Salvo!"
- "Excluído."
- "Atualizado."

---

## Trial Messaging

- New trial: "Seu teste gratuito começa agora. {n} dias para explorar tudo."
- Days remaining: "{n} dias restantes no seu teste"
- Last day: "Seu teste termina amanhã. Adicione uma forma de pagamento para continuar."
- Expired: "Seu teste terminou. Adicione uma forma de pagamento para continuar usando o Folhário."

---

## Confidence Display Guidelines
- Always show numeric %: "85% de confiança"
- Colors supplementary, never sole:
  - ≥70%: green (alta)
  - 40–69%: yellow (média)
  - <40%: red (baixa, but filtered below threshold anyway)
- Text label optional: "Alta / Média / Baixa confiança"

---

## Date & Time Formatting
- Dates: "12 de abril de 2026" (full) / "12/04/2026" (compact).
- Times: "09:00" 24h.
- Relative: "há 2 dias" / "em 3 horas" / "agora mesmo".
- All respect user timezone (`User.timezone`).

---

## Do-Not-Say List (jargon to avoid)
- Avoid: "espécie", "gênero", "fototropismo", "substrato orgânico", "fotossíntese" (unless necessary).
- Prefer: "planta", "tipo de terra", "quanto de sol ela precisa".
- Avoid: "IA", "modelo", "inferência". Prefer: "identificação automática", "gerado por IA" (only in mandatory disclaimer context).
- Avoid: shaming ("Você esqueceu!"). Prefer: neutral facts ("Atrasado").
