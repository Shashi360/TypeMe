/**
 * Subscription presentation helpers. The stored expiresAt timestamp is the
 * single source of truth — days remaining is always derived from it, never
 * from "30 minus local days" (device clocks can change; a backend record
 * wins when one exists).
 */
import type { User } from "../types";

export type SubscriptionState = "free" | "active" | "expiring" | "expired";

export interface SubscriptionSummary {
  state: SubscriptionState;
  daysRemaining: number;
  startedAt: number | null;
  expiresAt: number | null;
}

const EXPIRING_SOON_DAYS = 5;

export const getSubscriptionSummary = (user: User | null): SubscriptionSummary => {
  const empty: SubscriptionSummary = {
    state: "free",
    daysRemaining: 0,
    startedAt: null,
    expiresAt: null,
  };
  if (!user) return empty;
  const isPaid = user.tier === "pro" || user.tier === "creator";
  const sub = user.subscription;
  if (!isPaid || !sub) {
    return { ...empty, state: isPaid ? "active" : "free" };
  }
  if (sub.status === "expired" || sub.expiresAt <= Date.now()) {
    return { state: "expired", daysRemaining: 0, startedAt: sub.startedAt, expiresAt: sub.expiresAt };
  }
  const daysRemaining = Math.max(
    0,
    Math.ceil((sub.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return {
    state: daysRemaining <= EXPIRING_SOON_DAYS ? "expiring" : "active",
    daysRemaining,
    startedAt: sub.startedAt,
    expiresAt: sub.expiresAt,
  };
};

export const formatPlanDate = (ts: number | null): string => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
