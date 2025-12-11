"use client";

import { forwardRef, useEffect } from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui-components/react/scroll-area";

import { cn } from "@/utils/cn";

const ScrollArea = forwardRef(function ScrollArea({
  className,
  children,
  orientation,
  viewportRef,
  onScroll,
  ...props
}, ref) {
  // Sync external viewportRef with internal one
  useEffect(() => {
    if (viewportRef && ref?.current) {
      const viewport = ref.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport && viewportRef) {
        viewportRef.current = viewport;
      }
    }
  }, [viewportRef, ref]);

  return (
    <ScrollAreaPrimitive.Root className="size-full min-h-0" ref={ref} {...props}>
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "size-full overscroll-contain rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          className
        )}
        data-slot="scroll-area-viewport"
        onScroll={onScroll}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation === "both" ? (
        <>
          <ScrollBar orientation="vertical" />
          <ScrollBar orientation="horizontal" />
        </>
      ) : (
        <ScrollBar orientation={orientation} />
      )}
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
});

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "m-0.5 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
        className
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}>
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-purple-500/30 hover:bg-purple-500/50 transition-colors"
        data-slot="scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
