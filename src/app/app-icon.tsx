/** A gold card outline with a "C" on the indigo table: shared by icon.tsx and apple-icon.tsx. */
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
        background: "#16142b",
      }}
    >
      <div
        style={{
          width: 250 * u,
          height: 350 * u,
          borderRadius: 26 * u,
          border: `${18 * u}px solid #e9b949`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e9b949",
          fontSize: 190 * u,
          fontWeight: 700,
          transform: "rotate(-6deg)",
        }}
      >
        C
      </div>
    </div>
  );
}
