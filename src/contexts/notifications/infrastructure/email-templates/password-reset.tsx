// Phase 4 NOTIF-02: password-reset email template.
// Locked Paper Cream brand contract per UI-SPEC §7.
// Copy strings drafted by Claude per D-30 (founder reviews/refines during
// Phase 4 execution); subject + body strings are also mirrored in
// messages/pt-BR.json under email.passwordReset.*.
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

import type { PasswordResetProps } from "@contexts/notifications/domain/events";

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

export function PasswordResetEmail({ url, userEmail }: PasswordResetProps) {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>Redefinir sua senha — Folhário</title>
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
            Redefinir sua senha
          </Heading>
          <Text
            style={{
              color: COLORS.body,
              fontSize: 16,
              lineHeight: "24px",
              marginTop: 16,
            }}
          >
            Recebemos um pedido para redefinir a senha da conta {userEmail}. Se
            foi você, clique no botão abaixo. O link expira em 1 hora.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={url}
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
            <a href={url} style={{ color: COLORS.ctaBg }}>
              {url}
            </a>
          </Text>
          <Text
            style={{
              color: COLORS.body,
              fontSize: 14,
              marginTop: 32,
            }}
          >
            Se não foi você, ignore este e-mail — sua senha continua a mesma.
          </Text>
          <Hr style={{ borderColor: "#E8E1D0", margin: "24px 0" }} />
          <Text
            style={{
              color: COLORS.footer,
              fontSize: 12,
              lineHeight: "16px",
            }}
          >
            Você está recebendo este e-mail porque sua conta no Folhário pediu
            redefinição de senha.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
