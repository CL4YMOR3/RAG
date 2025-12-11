import { cn } from "@/utils/cn";

function Label({
  className,
  ...props
}) {
  return (
    <label
      className={cn("inline-flex items-center gap-2 text-sm/4", className)}
      data-slot="label"
      {...props} />
  );
}

export { Label };
