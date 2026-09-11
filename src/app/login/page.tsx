import type { Metadata } from "next";
import { Suspense } from "react";
import { CardFan } from "@/components/card-fan";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

// Three icons of the two games, fanned above the form: static, so the login page needs no DB.
const COVER = [
  {
    src: "https://cards.scryfall.io/small/front/d/5/d573ef03-4730-45aa-93dd-e45ac1dbaf4a.jpg?1783948684",
    alt: "Lightning Bolt",
  },
  {
    src: "https://cards.scryfall.io/small/front/b/0/b0faa7f2-b547-42c4-a810-839da50dadfe.jpg?1783948669",
    alt: "Black Lotus",
    foil: true,
  },
  { src: "https://assets.tcgdex.net/en/base/base1/4/low.webp", alt: "Charizard" },
];

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-4 text-center">
          <CardFan cards={COVER} size="sm" />
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Cardllector</h1>
            <p className="text-muted-foreground text-sm">Entra para ver tu colección.</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
