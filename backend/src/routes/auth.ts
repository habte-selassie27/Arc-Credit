import { Router } from "express";
import { randomBytes } from "crypto";
import { SiweMessage } from "siwe";
import jwt from "jsonwebtoken";
import { prisma } from "../index";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

router.post("/siwe/nonce", async (req, res) => {
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "address required" });
    return;
  }

  const nonce = randomBytes(16).toString("hex");
  await prisma.user.upsert({
    where: { address },
    create: { address, nonce },
    update: { nonce },
  });

  res.json({ nonce });
});

router.post("/siwe/verify", async (req, res) => {
  const { message, signature } = req.body;
  if (!message || !signature) {
    res.status(400).json({ error: "message and signature required" });
    return;
  }

  try {
    const siwe = new SiweMessage(message);
    const result = await siwe.verify({ signature });

    if (!result.success) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }

    await prisma.user.update({
      where: { address: siwe.address },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign({ address: siwe.address }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ token, address: siwe.address });
  } catch (err) {
    res.status(401).json({ error: "verification failed" });
  }
});

export { router as authRoutes };
