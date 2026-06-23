"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function RoomGuard({
  role,
  redirect,
  allowHostView,
  children,
}: {
  role: "host" | "player";
  redirect: string;
  allowHostView?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem("jeopardy_code");
    const userRole = sessionStorage.getItem("jeopardy_role");
    const hasHost = !!sessionStorage.getItem("jeopardy_host_secret");
    const hasPlayer = !!sessionStorage.getItem("jeopardy_player_id");

    if (!code) {
      router.replace(redirect);
      return;
    }
    if (role === "host" && (userRole !== "host" || !hasHost)) {
      router.replace(redirect);
      return;
    }
    if (role === "player") {
      const okPlayer = userRole === "player" && hasPlayer;
      const okHostView = allowHostView && userRole === "host" && hasHost;
      if (!okPlayer && !okHostView) {
        router.replace(redirect);
        return;
      }
    }
    setReady(true);
  }, [role, redirect, router, allowHostView]);

  if (!ready) return null;
  return <>{children}</>;
}
