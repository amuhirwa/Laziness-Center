import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUserId, isGuest } from "@/lib/identity"
import NewRecipeForm from "./new-form"

export default async function NewRecipePage() {
  if (isGuest(getUserId(await headers()))) redirect("/recipes")
  return <NewRecipeForm />
}
