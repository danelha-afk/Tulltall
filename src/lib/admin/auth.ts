import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hmac, safeEqual, sha256 } from "../security/crypto";
import { serverEnv } from "../config/env";

const COOKIE = "tt_admin";
const TTL_SECONDS = 12 * 3600;

function sign(exp: number): string {
  return `${exp}.${hmac(serverEnv.sessionSecret, `admin:${exp}`)}`;
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < now || !sig) return false;
  return safeEqual(sign(exp), token);
}

export function passwordMatches(input: string): boolean {
  const expected = serverEnv.adminPassword;
  if (!expected || expected.length < 10) return false; // admin er av hvis passord mangler eller er for kort
  return safeEqual(sha256(input), sha256(expected));
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminToken(jar.get(COOKIE)?.value);
}

/** Kalles øverst i alle admin-sider og server actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startAdminSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const jar = await cookies();
  const h = await headers();
  const secure = (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
  jar.set(COOKIE, sign(exp), { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: TTL_SECONDS });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
