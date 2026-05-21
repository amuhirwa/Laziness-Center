export const GUEST_USER = "guest@lovey.tv"

interface HeaderLike { get(name: string): string | null }

export function getUserId(headers: HeaderLike): string {
  return headers.get("remote-email") ?? headers.get("remote-user") ?? GUEST_USER
}

export function isGuest(userId: string): boolean {
  return userId === GUEST_USER
}
