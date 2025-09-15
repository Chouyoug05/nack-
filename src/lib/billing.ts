import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface BillingState {
  subscriptionActive: boolean;
  subscriptionPaidUntil?: Date | null;
  memberCredits: number;
  eventCredits: number;
}

export const TRIAL_DAYS = 7;

export function computeTrial(creationTime?: string | null): { isInTrial: boolean; trialEndsAt: Date } {
  const created = creationTime ? new Date(creationTime) : new Date();
  const end = new Date(created);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return { isInTrial: new Date() < end, trialEndsAt: end };
}

export async function getBillingForUser(uid: string): Promise<BillingState> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const d = snap.exists() ? (snap.data() as any) : {};
  const b = (d.billing || {}) as any;
  return {
    subscriptionActive: !!b.subscriptionActive,
    subscriptionPaidUntil: b.subscriptionPaidUntil?.toDate ? b.subscriptionPaidUntil.toDate() : null,
    memberCredits: Number(b.memberCredits ?? 0),
    eventCredits: Number(b.eventCredits ?? 0),
  };
}

export async function updateBilling(uid: string, patch: Partial<BillingState>) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { billing: { ...patch }, updatedAt: serverTimestamp() }, { merge: true });
}

export async function addMemberCredits(uid: string, count = 1) {
  const current = await getBillingForUser(uid);
  await updateBilling(uid, { memberCredits: (current.memberCredits || 0) + count });
}

export async function addEventCredits(uid: string, count = 1) {
  const current = await getBillingForUser(uid);
  await updateBilling(uid, { eventCredits: (current.eventCredits || 0) + count });
}

export async function decrementMemberCredit(uid: string) {
  const current = await getBillingForUser(uid);
  const next = Math.max(0, (current.memberCredits || 0) - 1);
  await updateBilling(uid, { memberCredits: next });
}

export async function decrementEventCredit(uid: string) {
  const current = await getBillingForUser(uid);
  const next = Math.max(0, (current.eventCredits || 0) - 1);
  await updateBilling(uid, { eventCredits: next });
}

export async function applyPaymentSuccess(uid: string, reference: string) {
  const refLower = reference.toLowerCase();
  if (refLower.includes('abonnement')) {
    // Activer pour 30 jours
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await updateBilling(uid, { subscriptionActive: true, subscriptionPaidUntil: until } as any);
    return;
  }
  if (refLower.includes('ajout')) {
    await addMemberCredits(uid, 1);
    return;
  }
  if (refLower.includes("événement") || refLower.includes("evenement")) {
    await addEventCredits(uid, 1);
    return;
  }
} 