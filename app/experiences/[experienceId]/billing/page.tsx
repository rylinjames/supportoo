import { BillingView } from "@/app/components/billing/billing-view";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  const { experienceId } = await params;
  return (
    <div className="h-full">
      <BillingView experienceId={experienceId} />
    </div>
  );
}
