// components/ShopStatusBadge.tsx

interface ShopStatusBadgeProps {
  isOpen: boolean;
}

export function ShopStatusBadge({ isOpen }: ShopStatusBadgeProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className={`relative flex h-4 w-4`}>
        <span
          className={`absolute inline-flex h-full w-full rounded-full -my-3 -mx-3 p-5 opacity-100 animate-ping ${
            isOpen ? "bg-green-400" : "bg-red-400"
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-4 w-4 ${
            isOpen ? "bg-green-500" : "bg-red-500"
          }`}
        ></span>
      </span>
      <span
        className={`text-xl font-bold mb-1 px-5 ${
          isOpen ? "text-green-600" : "text-red-500"
        }`}
      >
        {isOpen ? "باز" : "بسته"}
      </span>
    </div>
  );
}
