import type { BrowserContext } from "@playwright/test";
import { test as authedTest, expect } from "./authed-user";

type ReadOnlyFixtures = { readOnly: boolean };

export const test = authedTest.extend<ReadOnlyFixtures>({
  readOnly: [
    async ({ context }: { context: BrowserContext }, use: (r: boolean) => Promise<void>) => {
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
