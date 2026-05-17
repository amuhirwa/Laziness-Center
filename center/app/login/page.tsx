import { signIn } from "@/auth"

export default function LoginPage() {
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
            await signIn("pocket-id", { redirectTo: "/dashboard" })
          }}
        >
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
