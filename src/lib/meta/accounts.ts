import { accountId, meta } from "./client";
import { BusinessError } from "../business";
export async function validateAdAccount() {
  const account = await meta<{
    id: string;
    name: string;
    currency: string;
    timezone_name: string;
  }>(accountId(), "GET", { fields: "id,name,currency,timezone_name" });
  if (account.currency !== "THB")
    throw new BusinessError(
      "This version requires a Meta ad account billed in THB.",
    );
  if (account.timezone_name !== "Asia/Bangkok")
    throw new BusinessError(
      "Use an Asia/Bangkok Meta ad account so daily metrics match business dates.",
    );
  return account;
}
