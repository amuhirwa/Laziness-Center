import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUserId, isGuest } from "@/lib/identity"
import EditRecipeForm from "./edit-form"

type Props = { params: Promise<{ id: string }> }

export default async function EditRecipePage({ params }: Props) {
  if (isGuest(getUserId(await headers()))) redirect("/recipes")
  return <EditRecipeForm params={params} />
}
