import type { Metadata } from "next";
import { authCopy } from "@/lib/copy/auth";
import SignInPage from "../page";

export const metadata: Metadata = { title: authCopy.sentTitle };

// Auth.js appends its own query string to pages.verifyRequest, hence a dedicated route.
export default async function LinkSentPage() {
  return SignInPage({ searchParams: Promise.resolve({ envoye: "1" }) });
}
