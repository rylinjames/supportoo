"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface PaymentHistorySectionProps {
  billingHistory: any[]; // Array of billing events
}

export function PaymentHistorySection({
  billingHistory,
}: PaymentHistorySectionProps) {
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format amount (cents to dollars)
  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Get status badge
  const getStatusBadge = (eventType: string) => {
    switch (eventType) {
      case "payment_succeeded":
        return <Badge className="bg-green-500">Paid</Badge>;
      case "subscription_cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Get description
  const getDescription = (eventType: string, planName: string) => {
    switch (eventType) {
      case "payment_succeeded":
        return `${planName} - Monthly`;
      case "subscription_cancelled":
        return `${planName} - Cancelled`;
      default:
        return "Unknown transaction";
    }
  };

  if (billingHistory.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-h3 text-foreground">Payment History</h2>
          <p className="text-muted-foreground mt-1">
            View your billing history and download invoices
          </p>
        </div>

        <div className="text-center py-12">
          <p className="text-muted-foreground">No payment history available</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-h3 text-foreground">Payment History</h2>
        <p className="text-muted-foreground mt-1">
          View your billing history and download invoices
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-label text-foreground">
                  Date
                </th>
                <th className="text-left p-4 text-label text-foreground">
                  Description
                </th>
                <th className="text-left p-4 text-label text-foreground">
                  Amount
                </th>
                <th className="text-left p-4 text-label text-foreground">
                  Status
                </th>
                <th className="text-left p-4 text-label text-foreground">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((event, index) => (
                <tr
                  key={event._id}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className="p-4 text-body-sm text-foreground">
                    {formatDate(event.createdAt)}
                  </td>
                  <td className="p-4 text-body-sm text-foreground">
                    {getDescription(event.eventType, "Pro Plan")}
                  </td>
                  <td className="p-4 text-body-sm text-foreground">
                    {event.amount ? formatAmount(event.amount) : "N/A"}
                  </td>
                  <td className="p-4">{getStatusBadge(event.eventType)}</td>
                  <td className="p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        // TODO: Implement invoice download
                        toast.info("Invoice download coming soon");
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
