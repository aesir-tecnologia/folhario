import { PostHog } from "posthog-node";
import { clientEnv } from "@shared/config/client-env";

let _client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (_client) return _client;

  _client = new PostHog(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export async function shutdownPostHog(): Promise<void> {
  if (!_client) return;
  const instance = _client;
  _client = null;
  await instance.shutdown();
}
