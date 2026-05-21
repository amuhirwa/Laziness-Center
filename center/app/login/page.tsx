import { signIn } from "@/auth"

type Props = { searchParams: Promise<{ callbackUrl?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams
  const redirectTo = callbackUrl ?? "/dashboard"

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Laziness Center</h1>
          <p className="text-sm text-neutral-500">Your personal utility hub</p>
        </div>
        <form
          action={async () => {
            "use server"
            await signIn("pocket-id", { redirectTo })
          }}
        >
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
