/** A card outline with a "C": shared by icon.tsx and apple-icon.tsx. */
export function AppIcon({ size }: { size: number }) {
  const u = size / 512;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
      }}
    >
      <div
        style={{
          width: 250 * u,
          height: 350 * u,
          borderRadius: 26 * u,
          border: `${18 * u}px solid #fafafa`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fafafa",
          fontSize: 190 * u,
          fontWeight: 700,
        }}
      >
        C
      </div>
    </div>
  );
}
