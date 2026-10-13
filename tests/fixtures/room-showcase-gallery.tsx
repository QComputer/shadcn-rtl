import { createRoot } from "react-dom/client";
import { RoomShowcase } from "../../components/rooms/room-showcase";
import type { RoomCardData } from "../../lib/rooms/room-showcase-model";

// Browser-only fixture: existing conceptual assets, never published hotel media.
const rooms: readonly RoomCardData[] = [
  {
    kind: "concept",
    id: "multi-image-preview",
    title: "نمونه‌ی تصویری چندگانه",
    images: [
      { src: "/images/room-concept-1.webp", alt: "تصویر مفهومی یک؛ عکس واقعی هتل نیست" },
      { src: "/images/room-concept-2.webp", alt: "تصویر مفهومی دو؛ عکس واقعی هتل نیست" },
      { src: "/images/room-concept-3.webp", alt: "تصویر مفهومی سه؛ عکس واقعی هتل نیست" },
    ],
  },
  {
    kind: "concept",
    id: "single-image-preview",
    title: "نمونه‌ی تصویری تک‌عکس",
    images: [{ src: "/images/room-concept-1.webp", alt: "تصویر مفهومی تک‌عکس؛ عکس واقعی هتل نیست" }],
  },
];

const root = document.getElementById("root");
if (!root) throw new Error("Gallery fixture root is missing");
createRoot(root).render(<RoomShowcase rooms={rooms} />);
