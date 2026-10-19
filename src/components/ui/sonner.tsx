"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { InfoIcon } from "lucide-react"
import { FoxEmoji } from "@/components/fox-emoji"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <FoxEmoji motion="ok" className="size-7" alt="" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <FoxEmoji motion="sad" className="size-7" alt="" />
        ),
        error: (
          <FoxEmoji motion="sad" className="size-7" alt="" />
        ),
        loading: (
          <FoxEmoji motion="load" className="size-7" alt="" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
