// Phase 4 NOTIF-02: welcome-back email template (resolved Q1).
// Triggered when signup is attempted with an already-registered email; we
// return 200 + dispatch this template so the response is indistinguishable
// from a fresh signup (anti-enumeration).
//
// Locked Paper Cream brand contract per UI-SPEC §7. Copy mirrors
// messages/pt-BR.json email.welcomeBack.*.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components";

import type { WelcomeBackProps } from "@contexts/notifications/domain/events";

const COLORS = {
  bodyBg: "#FBF7EF",
  cardBg: "#FFFDF7",
  headline: "#143424",
  body: "#5A6358",
  ctaBg: "#1F4D35",
  ctaLabel: "#FFFDF7",
  footer: "#2B6F7A",
} as const;

const FONTS = {
  headline:
    "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif",
  body: "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

export function WelcomeBackEmail({ resetUrl, userEmail }: WelcomeBackProps) {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>Bem-vindo de volta ao Folhário</title>
      </Head>
      <Body
        style={{
          backgroundColor: COLORS.bodyBg,
          fontFamily: FONTS.body,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: COLORS.cardBg,
            maxWidth: 600,
            margin: "32px auto",
            padding: 32,
            borderRadius: 12,
          }}
        >
          <Heading
            style={{
              color: COLORS.headline,
              fontFamily: FONTS.headline,
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
            }}
          >
            Você já tem uma conta no Folhário
          </Heading>
          <Text
            style={{
              color: COLORS.body,
              fontSize: 16,
              lineHeight: "24px",
              marginTop: 16,
            }}
          >
            Recebemos uma nova solicitação de cadastro com {userEmail}, mas
            você já tem uma conta conosco. Para entrar, redefina sua senha pelo
            link abaixo.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: COLORS.ctaBg,
                color: COLORS.ctaLabel,
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Redefinir senha
            </Button>
          </Section>
          <Text
            style={{
              color: COLORS.body,
              fontSize: 14,
              lineHeight: "20px",
            }}
          >
            Se o botão não funcionar, copie e cole este link no navegador:{" "}
            <a href={resetUrl} style={{ color: COLORS.ctaBg }}>
              {resetUrl}
            </a>
          </Text>
          <Text
            style={{
              color: COLORS.body,
              fontSize: 14,
              marginTop: 32,
            }}
          >
            Se não foi você quem tentou criar uma conta, pode ignorar este
            e-mail — a sua conta segue intacta.
          </Text>
          <Hr style={{ borderColor: "#E8E1D0", margin: "24px 0" }} />
          <Text
            style={{
              color: COLORS.footer,
              fontSize: 12,
              lineHeight: "16px",
            }}
          >
            Você está recebendo este e-mail porque alguém tentou criar uma
            conta no Folhário com este e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
