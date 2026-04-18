// components/ShopStatusBadge.tsx

interface ShopStatusBadgeProps {
  isOpen: boolean;
}

export function ShopStatusBadge({ isOpen }: ShopStatusBadgeProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className={`relative flex h-3 w-3`}>
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
            isOpen ? "bg-green-400" : "bg-red-400"
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isOpen ? "bg-green-500" : "bg-red-500"
          }`}
        ></span>
      </span>
      <span
        className={`text-sm font-medium ${
          isOpen ? "text-green-600" : "text-red-500"
        }`}
      >
        {isOpen ? "باز" : "بسته"}
      </span>
    </div>
  );
}
