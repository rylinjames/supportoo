import { useState, useMemo } from "react";
import { Search, X, MessageSquare } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { usePreventZoom } from "@/app/hooks/use-prevent-zoom";
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { ConversationListItem } from "./conversation-list-item";
import type { Conversation, ConversationStatus } from "./types";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
}

const STATUS_FILTERS: { value: ConversationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "ai", label: "AI" },
  { value: "support", label: "Support" },
  { value: "resolved", label: "Resolved" },
];

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = usePreventZoom<HTMLInputElement>();
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">(
    "all"
  );
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "newest">(
    "recent"
  );

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (conv) =>
          conv.customerName.toLowerCase().includes(query) ||
          conv.customerUsername.toLowerCase().includes(query) ||
          conv.lastMessage.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((conv) => conv.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "recent") {
        return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
      } else if (sortBy === "oldest") {
        return a.createdAt.getTime() - b.createdAt.getTime();
      } else {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    return filtered;
  }, [conversations, searchQuery, statusFilter, sortBy]);

  // Separate available conversations
  const availableConversations = filteredConversations.filter(
    (c) => c.status === "available"
  );
  const otherConversations = filteredConversations.filter(
    (c) => c.status !== "available"
  );

  const availableCount = availableConversations.length;
  const hasFilters = searchQuery || statusFilter !== "all";

  return (
    <div className="flex flex-col h-full">
      {/* Header with Frosted Glass */}
      <div className="sticky top-0 z-10 frosted-glass border-b border-border">
        <div className="p-4">
          {/* Title with Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Conversations</h1>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10 pr-9 h-10 bg-secondary/50 border-0 focus:bg-background focus:ring-1 focus:ring-primary/20 transition-all"
              autoFocus={false}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Pill-style Status Filter + Sort */}
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-lg bg-secondary flex-1 overflow-x-auto">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    statusFilter === filter.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.value === "available" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5 inline-block" />
                  )}
                  {filter.label}
                </button>
              ))}
            </div>

            <Select
              value={sortBy}
              onValueChange={(value) =>
                setSortBy(value as "recent" | "oldest" | "newest")
              }
            >
              <SelectTrigger className="h-8 w-[100px] text-xs border-0 bg-secondary">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto pb-[72px] lg:pb-0">
        {/* Available Section - Highlighted */}
        {availableCount > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Needs Attention
              </h3>
              <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] hover:bg-orange-500/20">
                {availableCount}
              </Badge>
            </div>
            <div className="space-y-2 p-2 rounded-xl bg-orange-500/5 border border-orange-500/20">
              {availableConversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={conversation.id === selectedConversationId}
                  onClick={() => onSelectConversation(conversation.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Conversations */}
        <div className={`p-3 ${availableCount > 0 ? "pt-0" : ""}`}>
          {otherConversations.length > 0 ? (
            <>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                All Conversations
              </h3>
              <div className="space-y-2">
                {otherConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={conversation.id === selectedConversationId}
                    onClick={() => onSelectConversation(conversation.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-secondary mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {hasFilters ? "No matches found" : availableCount > 0 ? "All caught up!" : "No conversations yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {hasFilters
                  ? "Try adjusting your filters or search"
                  : availableCount > 0
                    ? "No other conversations need attention"
                    : "Customers will appear here when they start chatting"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
