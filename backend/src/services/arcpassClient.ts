import { publicClient, ARCPASS_ABI } from "../lib/arcClient";

const ATTESTATION_REGISTRY = process.env.ARCPASS_ATTESTATION_REGISTRY as `0x${string}` | undefined;
const SCORE_REGISTRY = process.env.ARCPASS_SCORE_REGISTRY as `0x${string}` | undefined;

const KYC_SCHEMA = "0x72632e6b79632e76310000000000000000000000000000000000000000000000" as `0x${string}`;
const REP_SCHEMA = "0x72632e72657075746174696f6e2e763100000000000000000000000000000000" as `0x${string}`;

export async function getAttestations(address: string) {
  // If ArcPass not configured, return mock (allows local dev without ArcPass deploy)
  if (!ATTESTATION_REGISTRY || !SCORE_REGISTRY || (ATTESTATION_REGISTRY as string) === "" || (SCORE_REGISTRY as string) === "") {
    return {
      kyc: { verified: false, schemaId: KYC_SCHEMA, attestation: null as any, isFresh: false },
      reputation: { score: 0, schemaId: REP_SCHEMA, updatedAt: 0, isFresh: false, raw: 0 },
    };
  }

  try {
    const [kycVerified, repResult, kycAtt] = await Promise.all([
      publicClient.readContract({
        address: SCORE_REGISTRY,
        abi: ARCPASS_ABI,
        functionName: "isKYCVerified",
        args: [address as `0x${string}`],
      }).catch(() => false as boolean),
      publicClient.readContract({
        address: SCORE_REGISTRY,
        abi: ARCPASS_ABI,
        functionName: "getReputationScore",
        args: [address as `0x${string}`],
      }).catch(() => [0, 0] as const),
      publicClient.readContract({
        address: ATTESTATION_REGISTRY,
        abi: ARCPASS_ABI,
        functionName: "getAttestation",
        args: [address as `0x${string}`, KYC_SCHEMA],
      }).catch(() => null as any),
    ]);

    const repScore = Array.isArray(repResult) ? Number((repResult as any)[0]) : 0;
    const repUpdatedAt = Array.isArray(repResult) ? Number((repResult as any)[1]) : 0;
    const now = Math.floor(Date.now() / 1000);
    const kycFresh = kycAtt ? (Number(kycAtt.expiresAt) > now || (now - Number(kycAtt.issuedAt) < 365 * 86400)) : false;
    const repFresh = repUpdatedAt ? (now - repUpdatedAt < 30 * 86400) : false;

    return {
      kyc: {
        verified: Boolean(kycVerified) && kycFresh,
        schemaId: KYC_SCHEMA,
        attestation: kycAtt,
        isFresh: kycFresh,
      },
      reputation: {
        score: repFresh ? repScore : 0,
        raw: repScore,
        schemaId: REP_SCHEMA,
        updatedAt: repUpdatedAt,
        isFresh: repFresh,
      },
    };
  } catch {
    return {
      kyc: { verified: false, schemaId: KYC_SCHEMA, attestation: null as any, isFresh: false },
      reputation: { score: 0, raw: 0, schemaId: REP_SCHEMA, updatedAt: 0, isFresh: false },
    };
  }
}

export async function getKycVerified(address: string): Promise<boolean> {
  const r = await getAttestations(address);
  return r.kyc.verified;
}

export async function getReputationScore(address: string): Promise<number> {
  const r = await getAttestations(address);
  return r.reputation.score;
}
