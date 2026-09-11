import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Card images and set icons (Scryfall, TCGdex). Rendered unoptimized: already sized.
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "svgs.scryfall.io" },
      { protocol: "https", hostname: "assets.tcgdex.net" },
    ],
  },
};

export default nextConfig;
