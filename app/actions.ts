"use server";
import { revalidatePath } from "next/cache";
import { collectAll } from "@/lib/collect";
export async function refreshHotlists() {
  await collectAll();
  revalidatePath("/");
  revalidatePath("/daily");
}
