"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid, Sparkles, Bell, ExternalLink } from "lucide-react";

export function MoreAppsView() {
  // Placeholder apps - can be populated with real apps later
  const comingSoonApps = [
    {
      name: "Email Marketing",
      description: "AI-powered email campaigns for your customers",
      icon: "📧",
    },
    {
      name: "Analytics Pro",
      description: "Advanced insights and reporting dashboard",
      icon: "📊",
    },
    {
      name: "CRM Integration",
      description: "Connect with your favorite CRM tools",
      icon: "🔗",
    },
    {
      name: "Automation Hub",
      description: "Automate your workflows and tasks",
      icon: "⚡",
    },
  ];

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <div>
          <h1 className="text-h2 font-semibold text-foreground">More Apps</h1>
          <p className="text-muted-foreground mt-1">
            Discover more tools to grow your business
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-8">
        {/* Current App */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Support AI Chat</h3>
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-powered customer support for your Whop store
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-h3 font-medium text-foreground">Coming Soon</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {comingSoonApps.map((app) => (
              <Card
                key={app.name}
                className="opacity-60 hover:opacity-80 transition-opacity cursor-not-allowed"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                      {app.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{app.name}</h3>
                        <Badge variant="outline" className="text-xs">Soon</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {app.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Empty State / CTA */}
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Grid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              More Apps Coming Soon
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're building more tools to help you grow your business on Whop.
              Stay tuned for new releases and updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
