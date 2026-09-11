"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Icon on phones, text from tablet width up. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Salir"
      className="size-8 px-0 md:w-auto md:px-2.5"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOutIcon className="md:hidden" />
      <span className="hidden md:inline">Salir</span>
    </Button>
  );
}
