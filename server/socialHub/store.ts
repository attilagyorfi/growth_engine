/**
 * A Social Hub-kapcsolat és a küldési napló tárolójának szerződése (G2).
 *
 * FIGYELEM: az adatbázisos megvalósításhoz új táblák kellenek (0026-os migráció), ezek
 * jóváhagyásra várnak. Addig a getSocialHubStore() null: a kapcsolat az env-ből jön (ahogy
 * eddig), a mentés és a küldés pedig nem érhető el (a felület sem mutatja).
 *
 * Amit a megvalósításnak garantálnia kell:
 *   - claim: EGY tranzakció; poszt + Social Hub-ügyfél szerint egyedi napló-sor, amelyet csak
 *     az foglalhat le, akinek az `expected` állapota még érvényes (compare-and-set). A kulcs,
 *     a cél ügyfél és a pontos törzs ugyanebben a tranzakcióban tárolódik.
 *   - reclaim: compare-and-set a runTokenre, így két egyidejű ismétlésből egy fut.
 *   - finishUnsent soha nem írja felül a már „sent” állapotot.
 */
export type StoredConnection = {
  baseUrl: string;
  apiKeyEnc: string;
  apiKeyLast4: string;
  updatedAt: Date | null;
};

export type SendAttemptStatus = "sending" | "sent" | "uncertain" | "failed";
export type DeliveryStatus = SendAttemptStatus | "new";

export type SendAttempt = {
  id: string;
  profileId: string;
  socialHubClientId: string;
  /** A cím hash-e: más Social Hubnak a régi kulcs és törzs nem küldhető. */
  baseUrlHash: string;
  idempotencyKey: string;
  /** A pontos kimenő JSON; ismétléskor bitre ugyanez megy. */
  body: string;
  /** A törzs drafts[] sorrendjében. */
  postIds: string[];
  status: SendAttemptStatus;
  runToken: string;
  firstTriedAt: Date;
  lastTriedAt: Date;
};

export type PostDelivery = {
  postId: string;
  socialHubClientId: string;
  status: DeliveryStatus;
  attemptId: string | null;
  /** Az utolsó kísérlet tartalma. */
  contentHash: string | null;
  /** Az utolsó SIKERES küldés tartalma, azonosítója és ideje. */
  sentHash: string | null;
  socialHubPostId: string | null;
  sentAt: Date | null;
};

export type ClaimItem = {
  postId: string;
  contentHash: string;
  draft: unknown;
  expected: { status: DeliveryStatus; attemptId: string | null };
};

export type ClaimInput = Omit<SendAttempt, "body" | "postIds" | "status"> & {
  createdBy: string;
  items: ClaimItem[];
  buildBody: (drafts: unknown[]) => string;
};

export interface SocialHubStore {
  getConnection(): Promise<StoredConnection | null>;
  saveConnection(input: { baseUrl: string; apiKeyEnc: string; apiKeyLast4: string; updatedBy: string }): Promise<void>;
  deleteConnection(): Promise<void>;
  getDeliveries(socialHubClientId: string, postIds: string[]): Promise<PostDelivery[]>;
  getAttempts(ids: string[]): Promise<SendAttempt[]>;
  /** Csak a valóban lefoglalt posztokból készül kísérlet; ha egy sem, null. */
  claim(input: ClaimInput): Promise<SendAttempt | null>;
  reclaim(attemptId: string, oldRunToken: string, newRunToken: string, now: Date): Promise<boolean>;
  finishSent(attemptId: string, sent: { postId: string; socialHubPostId: string }[], now: Date): Promise<void>;
  finishUnsent(attemptId: string, runToken: string, status: "failed" | "uncertain", lastError: string, now: Date): Promise<void>;
}

/** Az adatbázisos tároló; null, amíg az új táblák nincsenek meg. */
export function getSocialHubStore(): SocialHubStore | null {
  return null;
}
