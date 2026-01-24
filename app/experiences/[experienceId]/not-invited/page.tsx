"use client";

import { UserX } from "lucide-react";

export default function NotInvitedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
          <UserX className="w-8 h-8 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-3">
          You haven&apos;t been invited yet
        </h1>
        <p className="text-gray-400 mb-6">
          You have access to this Whop, but you need to be invited to join the support team.
          Please ask the team owner to add you as a team member.
        </p>
        <p className="text-sm text-gray-500">
          Once invited, refresh this page to continue.
        </p>
      </div>
    </div>
  );
}
