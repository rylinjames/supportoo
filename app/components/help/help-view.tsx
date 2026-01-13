"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  MessageCircle,
  ExternalLink,
  Mail,
  FileText,
  HelpCircle,
  Lightbulb,
  Rocket,
} from "lucide-react";

export function HelpView() {
  const resources = [
    {
      title: "Getting Started Guide",
      description: "Learn the basics of setting up your AI support assistant",
      icon: Rocket,
      href: "#",
    },
    {
      title: "Documentation",
      description: "Detailed guides and API documentation",
      icon: BookOpen,
      href: "#",
    },
    {
      title: "Best Practices",
      description: "Tips for getting the most out of your AI assistant",
      icon: Lightbulb,
      href: "#",
    },
    {
      title: "FAQ",
      description: "Frequently asked questions and answers",
      icon: HelpCircle,
      href: "#",
    },
  ];

  const faqs = [
    {
      question: "How do I customize my AI assistant's personality?",
      answer: "Go to AI Studio → Personality & Tone to configure how your AI responds to customers. You can choose from professional, friendly, casual, or technical tones.",
    },
    {
      question: "How does the handoff to human support work?",
      answer: "When certain triggers are met (like customer requesting human support, billing questions, or negative sentiment), the AI will automatically escalate the conversation and notify your support team.",
    },
    {
      question: "Can I add custom information for my AI to reference?",
      answer: "Yes! In AI Studio → Company Context, you can add information about your products, policies, and FAQs that the AI will use when responding to customers.",
    },
    {
      question: "How do I track my AI response usage?",
      answer: "Visit the Analytics → Usage page to see your current usage, remaining credits, and billing cycle information.",
    },
    {
      question: "What happens when I reach my response limit?",
      answer: "When you reach your monthly limit, the AI will stop responding automatically. You can upgrade your plan to get more responses or wait for the next billing cycle.",
    },
  ];

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <div>
          <h1 className="text-h2 font-semibold text-foreground">Help & Support</h1>
          <p className="text-muted-foreground mt-1">
            Get help using your AI support assistant
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-8">
        {/* Quick Resources */}
        <div>
          <h2 className="text-h3 font-medium text-foreground mb-4">Resources</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {resources.map((resource) => (
              <Card key={resource.title} className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <resource.icon className="h-5 w-5 text-primary" />
                    {resource.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{resource.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-h3 font-medium text-foreground mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Need More Help?
            </CardTitle>
            <CardDescription>
              Can't find what you're looking for? Our support team is here to help.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View All Docs
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
