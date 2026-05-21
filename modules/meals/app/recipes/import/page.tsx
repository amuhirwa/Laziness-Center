import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUserId, isGuest } from "@/lib/identity"
import ImportForm from "./import-form"

export default async function ImportPage() {
  if (isGuest(getUserId(await headers()))) redirect("/recipes")
  return <ImportForm />
}
