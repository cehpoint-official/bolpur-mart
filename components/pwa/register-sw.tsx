"use client"

import { useEffect } from "react"

export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("✅ SW registered: ", reg))
          .catch((err) => console.error("❌ SW registration failed: ", err))
      }

      if (document.readyState === "complete" || document.readyState === "interactive") {
        register()
      } else {
        window.addEventListener("load", register)
        return () => window.removeEventListener("load", register)
      }
    }
  }, [])

  return null
}
