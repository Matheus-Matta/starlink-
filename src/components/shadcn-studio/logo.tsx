import { QrCodeIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="bg-primary text-primary-foreground flex size-8.5 items-center justify-center rounded-full">
        <QrCodeIcon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-xl font-bold">Starlink</span>
    </div>
  );
};

export default Logo;
