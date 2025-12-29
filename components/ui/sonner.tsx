"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--card-foreground)",
          border: "1px solid var(--border)",
          fontSize: "12px",
        },
        classNames: {
          toast: "text-body-sm",
          description: "!text-body-sm !text-muted-foreground !opacity-100",
          actionButton:
            "!bg-primary !text-primary-foreground hover:!bg-primary/90 !text-body-sm !h-8 !ml-auto",
          cancelButton:
            "!bg-muted !text-foreground hover:!bg-muted/80 !text-body-sm !h-8",
          closeButton:
            "!bg-transparent !text-foreground/50 hover:!text-foreground",
          success: "!border-l-4 !border-l-green-500",
          error: "!border-l-4 !border-l-red-500",
          warning: "!border-l-4 !border-l-yellow-500",
          info: "!border-l-4 !border-l-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
