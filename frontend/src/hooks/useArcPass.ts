import { useState, useEffect } from "react";

interface Attestation {
  kyc: { verified: boolean; schemaId: string };
  reputation: { score: number; schemaId: string };
}

export function useArcPass(address?: string) {
  const [attestations, setAttestations] = useState<Attestation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    setIsLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

    fetch(`${apiUrl}/api/v1/arcpass/${address}`)
      .then((res) => res.json())
      .then((data) => {
        setAttestations(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [address]);

  return {
    attestations,
    kycVerified: attestations?.kyc.verified ?? false,
    reputationScore: attestations?.reputation.score ?? 0,
    isLoading,
  };
}
