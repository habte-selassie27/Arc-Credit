// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArcPass {
    struct Attestation {
        address subject;
        bytes32 schemaId;
        uint256 issuedAt;
        uint256 expiresAt;
        bytes   data;
    }

    function getAttestation(address subject, bytes32 schemaId)
        external view returns (Attestation memory);

    function getReputationScore(address subject)
        external view returns (uint16 score, uint32 updatedAt);

    function isKYCVerified(address subject)
        external view returns (bool);
}
