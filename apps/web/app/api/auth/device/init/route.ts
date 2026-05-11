import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateDeviceCode,
  generateUserCode,
  hashDeviceCode,
} from "@/lib/deviceAuth";
import { getPublicAppOrigin } from "@/lib/http/publicOrigin";

const EXPIRES_SEC = 900;
const INTERVAL_SEC = 5;

export async function POST(req: Request) {
  const origin = getPublicAppOrigin(req);
  const expiresAt = new Date(Date.now() + EXPIRES_SEC * 1000);

  for (let attempt = 0; attempt < 8; attempt++) {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    try {
      await prisma.deviceAuthSession.create({
        data: {
          deviceCodeHash: hashDeviceCode(deviceCode),
          userCode,
          status: "pending",
          expiresAt,
        },
      });
      const verificationUri = `${origin}/device`;
      const verificationUriComplete = `${origin}/device?user_code=${encodeURIComponent(userCode)}`;
      return NextResponse.json({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUriComplete,
        expires_in: EXPIRES_SEC,
        interval: INTERVAL_SEC,
      });
    } catch {
      /* unique collision on userCode */
    }
  }

  return NextResponse.json({ error: "device_init_failed" }, { status: 500 });
}
