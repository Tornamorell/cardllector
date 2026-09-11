import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// One family, two voices: expanded width for headings, normal width for text (globals.css).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cardllector", template: "%s · Cardllector" },
  description: "Tu colección de cartas, con precio.",
  applicationName: "Cardllector",
  // Full-screen when added to the iPhone home screen.
  appleWebApp: { capable: true, title: "Cardllector", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the full-screen scanner use the whole screen (notch areas via safe-area insets).
  viewportFit: "cover",
  themeColor: "#16142b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Dark only for now: the "play table at night" identity (docs/design.md).
    <html lang="es" className={`dark ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
