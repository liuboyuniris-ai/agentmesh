export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri?: string;
};

export async function fetchOidcDiscovery(
  issuerRaw: string
): Promise<OidcDiscoveryDocument> {
  const trimmed = issuerRaw.trim().replace(/\/$/, "");
  const docUrl = trimmed.endsWith("/.well-known/openid-configuration")
    ? trimmed
    : `${trimmed}/.well-known/openid-configuration`;
  const res = await fetch(docUrl);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status}`);
  }
  const doc = (await res.json()) as OidcDiscoveryDocument;
  if (
    !doc.authorization_endpoint ||
    !doc.token_endpoint ||
    !doc.issuer
  ) {
    throw new Error("OIDC discovery document incomplete");
  }
  return doc;
}
