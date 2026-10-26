import "server-only";

import { database } from "./database";
import { AFFILIATE_COOKIE } from "./affiliates";
import { cookieValue } from "./affiliate-attribution-store";

export async function recordAffiliateAccountCreated(input: {
  userId: string;
  createdAt: Date | string;
  cookieHeader?: string | null;
}) {
  const token = cookieValue(input.cookieHeader ?? null, AFFILIATE_COOKIE);
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const result = await database.query(
    `UPDATE affiliate_clicks click
     SET account_created_at=COALESCE(click.account_created_at,now()),
         account_user_id=COALESCE(click.account_user_id,$2)
     WHERE click.attribution_token=$1::uuid
       AND click.created_at <= $3::timestamptz
       AND (click.account_user_id IS NULL OR click.account_user_id=$2)
     RETURNING click.id`,
    [token, input.userId, input.createdAt],
  );
  return Boolean(result.rows[0]);
}
