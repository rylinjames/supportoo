"use client";

import { CustomerChatView } from "@/app/components/customer/customer-chat-view";
import { useParams, useSearchParams } from "next/navigation";

export default function CustomerViewPage() {
  const { experienceId } = useParams() as { experienceId: string };
  const searchParams = useSearchParams();

  // Dev mode: Force customer ID from URL (?customerId=xxx)
  const forceCustomerId = searchParams.get("customerId");

  return (
    <div className="h-screen w-full">
      <CustomerChatView
        experienceId={experienceId}
        forceCustomerId={forceCustomerId || undefined}
      />
    </div>
  );
}
