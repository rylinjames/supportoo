import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
}

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-h2 mb-3">Conversations</h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 pr-9 h-9 text-body-sm placeholder:text-body-sm"
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

        {/* Filters */}
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ConversationStatus | "all")
            }
          >
            <SelectTrigger className="h-8 text-body-sm flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="support">Support Staff</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy(value as "recent" | "oldest" | "newest")
            }
          >
            <SelectTrigger className="h-8 text-body-sm flex-1">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto pb-[72px] lg:pb-0">
        {/* Available Section */}
        {availableCount > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <h3 className="text-label-sm text-foreground uppercase tracking-wide">
                Available
              </h3>
              <Badge
                variant="secondary"
                className="h-5 px-2 text-[10px] bg-orange/20 text-orange hover:bg-orange/20"
              >
                {availableCount}
              </Badge>
            </div>
            <div>
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
              <h3 className="text-label-sm text-muted-foreground uppercase tracking-wide mb-2 px-1">
                All Conversations
              </h3>
              <div>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-label text-muted-foreground mb-1">
                {searchQuery || statusFilter !== "all"
                  ? "No conversations found"
                  : availableCount > 0
                    ? "All caught up! 🎉"
                    : "No conversations yet"}
              </p>
              <p className="text-caption text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : availableCount > 0
                    ? "No conversations need attention"
                    : "Customers will appear here when they start chatting"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
