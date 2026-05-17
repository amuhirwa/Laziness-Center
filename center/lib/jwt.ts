import {
  generateKeyPair,
  exportJWK,
  importJWK,
  importPKCS8,
  SignJWT,
  type CryptoKeyPair,
} from "jose"

type KeySet = { privateKey: CryptoKey; publicKey: CryptoKey; publicJwk: JsonWebKey }

let _keyPairPromise: Promise<KeySet> | null = null

function getKeyPair(): Promise<KeySet> {
  if (!_keyPairPromise) {
    const pem = process.env.CENTER_JWT_PRIVATE_KEY

    if (pem) {
      // Persistent key — survives Center restarts. Tokens minted before a restart
      // remain valid for their 5-minute TTL.
      _keyPairPromise = (async (): Promise<KeySet> => {
        const privateKey = await importPKCS8(pem, "RS256")
        // Derive public key: export private JWK (contains public params n+e), strip private params
        const privateJwk = await exportJWK(privateKey)
        const publicJwk: JsonWebKey = { kty: privateJwk.kty, n: privateJwk.n, e: privateJwk.e }
        const publicKey = (await importJWK(publicJwk, "RS256")) as CryptoKey
        return { privateKey, publicKey, publicJwk }
      })()
    } else {
      // Ephemeral fallback — fresh key on every process start.
      // Any in-flight tokens are invalidated on Center restart (max 5-min disruption).
      // Set CENTER_JWT_PRIVATE_KEY in .env to avoid this.
      _keyPairPromise = generateKeyPair("RS256", { extractable: true }).then(
        async ({ privateKey, publicKey }) => ({
          privateKey,
          publicKey,
          publicJwk: await exportJWK(publicKey),
        })
      )
    }
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
