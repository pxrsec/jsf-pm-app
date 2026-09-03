import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateAccountScope(): void {
  revalidatePath("/cuenta", "page");
  revalidatePath("/en/cuenta", "page");
}

export function revalidateManagerScope(): void {
  revalidatePath("/admin/acceso", "page");
  revalidatePath("/en/admin/acceso", "page");
  revalidatePath("/pm/acceso", "page");
  revalidatePath("/en/pm/acceso", "page");
}
