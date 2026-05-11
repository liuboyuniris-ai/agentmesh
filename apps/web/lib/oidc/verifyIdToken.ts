import * as jose from "jose";
import type { OidcDiscoveryDocument } from "@/lib/oidc/discovery";

export async function verifyOidcIdToken(params: {
  idToken: string;
  discovery: OidcDiscoveryDocument;
  clientId: string;
  /** Defaults to clientId; some IdPs require a separate resource audience. */
  audience?: string;
}): Promise<jose.JWTPayload> {
  const jwksUri = params.discovery.jwks_uri;
  if (!jwksUri) {
    throw new Error("OIDC discovery missing jwks_uri");
  }

  const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
  const audience =
    params.audience?.trim() && params.audience.trim().length > 0
      ? params.audience.trim()
      : params.clientId;

  const { payload } = await jose.jwtVerify(params.idToken, JWKS, {
    issuer: params.discovery.issuer,
    audience,
    clockTolerance: 60,
  });

  return payload;
}
