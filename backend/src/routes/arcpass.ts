import { Router } from "express";
import { getAttestations } from "../services/arcpassClient";

const router = Router();

router.get("/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const attestations = await getAttestations(address);
    res.json(attestations);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch attestations" });
  }
});

export { router as arcpassRoutes };
