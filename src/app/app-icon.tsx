import { LogoMark } from "@/components/logo";

/**
 * The app icon: the «Abanico» mark on the indigo table, lit from the top left. Shared by
 * icon.tsx (browser tab, install) and apple-icon.tsx (home screen); the OS rounds the corners.
 */
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#16142b",
        backgroundImage: "radial-gradient(circle at 30% 15%, #221f40 0%, #16142b 60%)",
      }}
    >
      <LogoMark size={size} />
    </div>
  );
}
