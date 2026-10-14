import type { ComponentProps } from "react";

// Browser harness adapter only. Production continues to render next/image.
/* eslint @next/next/no-img-element: off -- Native img is required in this isolated test replacement. */
export default function FixtureImage(props: ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean; priority?: boolean }) {
  const { fill, sizes, style, ...imageProps } = props;
  delete imageProps.unoptimized;
  delete imageProps.priority;
  return <img {...imageProps} alt={imageProps.alt ?? ""} style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}), ...style }} sizes={sizes} />;
}
