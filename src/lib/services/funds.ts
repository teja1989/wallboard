import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { collections, fundsConfig, calculateContributionFees } from '@/config';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import { eventRef } from '@/lib/services/events';
import type { Actor, CashContributionDoc, CashFundDoc, EventDoc, PostDoc } from '@/types/domain';
import type { ContributeToFundInput, CreateFundInput } from '@/lib/validation/schemas';

/**
 * Collective Cash Funds and Dream Gifting service.
 *
 * Manages gift pots, contributions, fee calculation, and celebratory wall tributes.
 */

export async function listFundsForEvent(eventId: string): Promise<CashFundDoc[]> {
  const snapshot = await eventRef(eventId)
    .collection(collections.funds)
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<CashFundDoc, 'id'>),
    id: doc.id,
  }));
}

export async function createCashFund(
  event: EventDoc,
  input: CreateFundInput,
): Promise<CashFundDoc> {
  const existing = await listFundsForEvent(event.id);
  if (existing.length >= fundsConfig.maxFundsPerEvent) {
    throw new ApiError(
      'conflict',
      `You can create up to ${fundsConfig.maxFundsPerEvent} cash pots per event.`,
    );
  }

  const fundId = `fund_${randomUUID().slice(0, 12)}`;
  const now = Date.now();

  const fund: CashFundDoc = {
    id: fundId,
    eventId: event.id,
    title: input.title,
    description: input.description,
    category: input.category,
    targetAmount: input.targetAmount,
    currentAmount: 0,
    contributorCount: 0,
    suggestedPresets: input.suggestedPresets,
    currency: 'USD',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await eventRef(event.id).collection(collections.funds).doc(fundId).set(fund);

  return fund;
}

export async function deleteCashFund(eventId: string, fundId: string): Promise<void> {
  await eventRef(eventId).collection(collections.funds).doc(fundId).delete();
}

export async function recordContribution(
  event: EventDoc,
  input: ContributeToFundInput,
  actor: Actor,
): Promise<{ contribution: CashContributionDoc; fund: CashFundDoc }> {
  const fundRef = eventRef(event.id).collection(collections.funds).doc(input.fundId);
  const fundSnap = await fundRef.get();

  if (!fundSnap.exists) {
    throw new ApiError('not_found', 'That gift fund could not be found.');
  }

  const fundData = fundSnap.data() as CashFundDoc;
  const now = Date.now();
  const fees = calculateContributionFees(input.amount);
  const contribId = `contrib_${randomUUID().slice(0, 12)}`;

  const displayName = input.isAnonymous
    ? 'A generous friend'
    : input.contributorName.trim() || actor.displayName || 'A friend';

  const contribution: CashContributionDoc = {
    id: contribId,
    fundId: input.fundId,
    eventId: event.id,
    contributorUid: actor.uid,
    contributorName: displayName,
    amount: input.amount,
    feeAmount: fees.platformFee,
    message: input.message,
    isAnonymous: input.isAnonymous,
    postToWall: input.postToWall,
    createdAt: now,
  };

  const contribRef = eventRef(event.id).collection(collections.contributions).doc(contribId);

  // Optional: Post celebratory tribute to the live wall feed
  let postRef: FirebaseFirestore.DocumentReference | null = null;
  let postDoc: PostDoc | null = null;

  if (input.postToWall) {
    postRef = eventRef(event.id).collection(collections.posts).doc();
    postDoc = {
      id: postRef.id,
      eventId: event.id,
      kind: 'text',
      authorUid: actor.uid,
      authorName: displayName,
      authorPhotoUrl: actor.photoUrl,
      body: input.message
        ? `🎁 Contributed $${input.amount} to the ${fundData.title}: "${input.message}"`
        : `🎁 Contributed $${input.amount} to the ${fundData.title}!`,
      media: [],
      state: 'visible',
      giftTribute: {
        fundTitle: fundData.title,
        amount: input.amount,
      },
      createdAt: now,
      expiresAt: event.expiresAt,
    };
  }

  await db().runTransaction(async (transaction) => {
    transaction.set(contribRef, contribution);
    transaction.update(fundRef, {
      currentAmount: FieldValue.increment(input.amount),
      contributorCount: FieldValue.increment(1),
      updatedAt: now,
    });

    if (postRef && postDoc) {
      transaction.set(postRef, {
        ...postDoc,
        expiresAtTtl: new Date(event.expiresAt),
      });
      transaction.update(eventRef(event.id), {
        postCount: FieldValue.increment(1),
      });
    }
  });

  const updatedFund: CashFundDoc = {
    ...fundData,
    currentAmount: fundData.currentAmount + input.amount,
    contributorCount: fundData.contributorCount + 1,
    updatedAt: now,
  };

  return { contribution, fund: updatedFund };
}
