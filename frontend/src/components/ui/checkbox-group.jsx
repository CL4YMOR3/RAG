"use client";

import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui-components/react/checkbox-group";

import { cn } from "@/utils/cn";

function CheckboxGroup({
  className,
  ...props
}) {
  return (<CheckboxGroupPrimitive className={cn("flex flex-col items-start gap-3", className)} {...props} />);
}

export { CheckboxGroup };
