import { generateKeyPair, exportJWK, SignJWT, type CryptoKeyPair } from "jose"

// Lazy-initialised RSA key pair. Generated once per process lifetime.
// On Center restart all in-flight 5-minute tokens are invalidated — acceptable.
let _keyPairPromise: Promise<CryptoKeyPair & { publicJwk: JsonWebKey }> | null = null

function getKeyPair() {
  if (!_keyPairPromise) {
    _keyPairPromise = generateKeyPair("RS256", { extractable: true }).then(
      async ({ privateKey, publicKey }) => ({
        privateKey,
        publicKey,
        publicJwk: await exportJWK(publicKey),
      })
    )
  }
  return _keyPairPromise
}

/** Mint a 5-minute service token allowing `caller` to call `target`. */
export async function mintServiceToken(caller: string, target: string): Promise<string> {
  const { privateKey } = await getKeyPair()
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("lc-center")
    .setSubject(caller)
    .setAudience(target)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(crypto.randomUUID())
    .sign(privateKey)
}

/** JWK representation of the public key — served to modules for local verification. */
export async function getPublicJwk(): Promise<JsonWebKey> {
  const { publicJwk } = await getKeyPair()
  return publicJwk
}

/** Raw CryptoKey — used internally if the Center needs to verify its own tokens. */
export async function getPublicKey(): Promise<CryptoKey> {
  const { publicKey } = await getKeyPair()
  return publicKey
}
