"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAuthToken } from "@/lib/session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.replace("/jobs");
      return;
    }
    router.replace("/auth/login");
  }, [router]);

  return <div className="min-h-screen bg-paper" />;
}
