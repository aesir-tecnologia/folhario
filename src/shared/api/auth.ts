import { ErrorCode } from "@shared/config/errors";
import {
  getCurrentUser,
  type CurrentUserResult,
} from "@contexts/iam/application/current-user";

/**
 * `requireApiUser(request)` — the auth gate every protected `/api/v1/*` route
 * helper calls before doing any work.
 *
 * Reads `request.headers.get("authorization")`, runs cryptographic JWT
 * verification + users-row lookup via the IAM application layer, and returns
 * a closed-registry-shaped result. Routes map failures to `errorResponse`
 * from `@shared/config/errors`.
 *
 * This is the AUTHORITATIVE auth check. The Next 16 proxy in `src/proxy.ts`
 * does only fast missing-bearer rejection (T-02-18 mitigation: no
 * authorization in proxy alone).
 */

export type ApiUserResult = CurrentUserResult;

export async function requireApiUser(request: Request): Promise<ApiUserResult> {
  const header = request.headers.get("authorization");
  return getCurrentUser(header);
}

// Re-export ErrorCode so route helpers can import the auth surface in one go.
export { ErrorCode };
