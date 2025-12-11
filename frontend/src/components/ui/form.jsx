"use client";

import { Form as FormPrimitive } from "@base-ui-components/react/form";

import { cn } from "@/utils/cn";

function Form({
  className,
  ...props
}) {
  return (
    <FormPrimitive
      className={cn("flex w-full flex-col gap-4", className)}
      data-slot="form"
      {...props} />
  );
}

export { Form };
