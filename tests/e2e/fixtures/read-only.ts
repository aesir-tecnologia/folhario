import type { BrowserContext } from "@playwright/test";
import { test as authedTest, expect, type AuthedUser } from "./authed-user";

type ReadOnlyFixtures = { readOnly: boolean };

export const test = authedTest.extend<ReadOnlyFixtures>({
  readOnly: [
    async (
      { context, authedUser }: { context: BrowserContext; authedUser: AuthedUser },
      use: (r: boolean) => Promise<void>,
    ) => {
      void authedUser;
      await context.addCookies([
        {
          name: "__test_subscription_read_only",
          value: "1",
          domain: "localhost",
          path: "/",
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ]);
      await use(true);
    },
    { auto: true },
  ],
});

export { expect };
