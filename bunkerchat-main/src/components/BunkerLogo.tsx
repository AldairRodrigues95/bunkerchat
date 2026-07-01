import { cn } from "@/lib/utils";

type BunkerLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-16 w-16",
};

export function BunkerLogo({ className, size = "md" }: BunkerLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Bunker Chat"
      className={cn("object-contain", sizes[size], className)}
      draggable={false}
    />
  );
}
