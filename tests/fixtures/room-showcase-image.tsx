import type { ComponentProps } from "react";

// Browser harness adapter only. Production continues to render next/image.
export default function FixtureImage({ fill, sizes, style, ...props }: ComponentProps<"img"> & { fill?: boolean }) {
  return <img {...props} style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}), ...style }} sizes={sizes} />;
}
