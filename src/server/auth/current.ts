import { cookies } from "next/headers";
import { userFromSessionToken, type CurrentUser } from "./guards";

const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** Người dùng hiện tại cho Server Component và Server Action; trống nếu chưa đăng nhập. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = COOKIE_NAMES.map((n) => store.get(n)?.value).find(Boolean) ?? null;
  return userFromSessionToken(token);
}
