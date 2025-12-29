"use client";

import { useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function DesignSystemPlayground() {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h1 text-foreground">
                Design System Playground
              </h1>
              <p className="text-body-sm text-muted-foreground mt-0.5">
                AI Support Agent - Testing our design system
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={toggleTheme}>
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6 space-y-6">
        {/* Colors Section */}
        <Card className="p-6">
          <h2 className="text-h2 mb-4">Color System</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="h-20 rounded-lg bg-primary mb-2" />
              <p className="text-caption text-muted-foreground">Primary</p>
            </div>
            <div>
              <div className="h-20 rounded-lg bg-secondary mb-2" />
              <p className="text-caption text-muted-foreground">Secondary</p>
            </div>
            <div>
              <div className="h-20 rounded-lg bg-muted mb-2" />
              <p className="text-caption text-muted-foreground">Muted</p>
            </div>
            <div>
              <div className="h-20 rounded-lg bg-destructive mb-2" />
              <p className="text-caption text-muted-foreground">Destructive</p>
            </div>
            <div>
              <div className="h-20 rounded-lg bg-card border border-border mb-2" />
              <p className="text-caption text-muted-foreground">Card</p>
            </div>
          </div>
        </Card>

        {/* Typography Section */}
        <Card className="p-6">
          <h2 className="text-h2 mb-4">Typography</h2>
          <div className="space-y-3">
            <div>
              <p className="text-display-lg">Display Large (32px)</p>
            </div>
            <div>
              <p className="text-h1">Heading 1 (20px)</p>
            </div>
            <div>
              <p className="text-h2">Heading 2 (16px)</p>
            </div>
            <div>
              <p className="text-h3">Heading 3 (14px)</p>
            </div>
            <div>
              <p className="text-body-sm">
                Body Small (12px) - Most UI elements
              </p>
            </div>
            <div>
              <p className="text-label">Label (12px)</p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">
                Caption (11px)
              </p>
            </div>
          </div>
        </Card>

        {/* Components Section */}
        <Card className="p-6">
          <h2 className="text-h2 mb-4">Components</h2>

          <div className="space-y-6">
            {/* Buttons */}
            <div>
              <h3 className="text-h3 mb-3">Buttons</h3>
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h3 className="text-h3 mb-3">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>

            {/* Form Elements */}
            <div>
              <h3 className="text-h3 mb-3">Form Elements</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="Enter your email" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="notifications" />
                  <Label htmlFor="notifications">Enable notifications</Label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Spacing Section */}
        <Card className="p-6">
          <h2 className="text-h2 mb-4">Spacing (4px grid)</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-primary" />
              <p className="text-body-sm">gap-1 (4px)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-4 bg-primary" />
              <p className="text-body-sm">gap-4 (16px)</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-4 w-4 bg-primary" />
              <p className="text-body-sm">gap-6 (24px)</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
