"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Send, Paperclip, Loader2, X } from "lucide-react";
import {
  MessageBubble,
  type Message as MessageBubbleMessage,
} from "../support/message-bubble";
import { MessageListSkeleton } from "../support/message-skeleton";
import { TypingIndicator } from "../support/typing-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { usePreventZoom } from "@/app/hooks/use-prevent-zoom";

interface CustomerChatDetailProps {
  conversation: any;
  userId: string;
  experienceId: string;
}

interface Message {
  _id: string;
  role: "customer" | "ai" | "agent" | "system";
  content: string;
  timestamp: number;
  readByCustomerAt?: number;
  readByAgentAt?: number;
  aiModel?: string;
  tokensUsed?: number;
  processingTime?: number;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  systemMessageType?:
    | "handoff"
    | "agent_joined"
    | "agent_left"
    | "issue_resolved";
}

export function CustomerChatDetail({
  conversation,
  userId,
  experienceId,
}: CustomerChatDetailProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [beforeTimestamp, setBeforeTimestamp] = useState<number | undefined>(
    undefined
  );
  const [presenceReady, setPresenceReady] = useState(false);
  const [presenceId, setPresenceId] = useState<Id<"presence"> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = usePreventZoom<HTMLTextAreaElement>();

  const sendMessage = useMutation(api.messages.mutations.sendCustomerMessage);
  const uploadFile = useAction(api.uploadthing.actions.uploadFile);
  const updatePresence = useMutation(api.presence.mutations.updatePresence);
  const heartbeat = useMutation(api.presence.mutations.heartbeat);
  const markAsRead = useMutation(
    api.messages.mutations.markMessagesAsReadByCustomer
  );

  // Live messages query with pagination support
  // Live query for real-time updates (latest 50 messages)
  const liveMessages = useQuery(api.messages.queries.getMessages, {
    conversationId: conversation._id as Id<"conversations">,
    limit: 50,
  }) as Message[] | undefined;

  // Query for older messages when needed
  const olderMessages = useQuery(
    api.messages.queries.getMessages,
    beforeTimestamp
      ? {
          conversationId: conversation._id as Id<"conversations">,
          before: beforeTimestamp,
          limit: 50,
        }
      : "skip"
  ) as Message[] | undefined;

  // Typing indicators
  const typingUsers = useQuery(
    api.presence.queries.getConversationPresence,
    conversation._id
      ? {
          conversationId: conversation._id as Id<"conversations">,
          excludeUserId: userId as Id<"users">,
        }
      : "skip"
  );

  const isAITyping = conversation.aiProcessing || false;
  const isAgentTyping = typingUsers?.some((u: any) => u.userRole === "support");

  // Message transformation
  const transformMessage = (msg: any): MessageBubbleMessage => ({
    id: msg._id,
    type: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    agentId: msg.agentId,
    agentName: msg.agentName,
    agentAvatar: msg.agentAvatar,
    readByCustomerAt: msg.readByCustomerAt,
    readByAgentAt: msg.readByAgentAt,
    attachment: msg.attachmentUrl
      ? {
          name: msg.attachmentName || "image",
          size: msg.attachmentSize || 0,
          type: msg.attachmentType || "image/jpeg",
          url: msg.attachmentUrl,
        }
      : undefined,
  });

  // Load older messages function
  const loadOlderMessages = () => {
    if (!allMessages.length || !hasMoreMessages || isLoadingOlder) return;

    const oldestMessage = allMessages[0];
    setBeforeTimestamp(oldestMessage.timestamp);
    setIsLoadingOlder(true);
    previousScrollHeightRef.current = scrollRef.current?.scrollHeight || 0;
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedImage) || isSending || isUploading) return;

    const messageContent = message.trim();
    setMessage("");
    setIsSending(true);
    setIsUploading(true);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentSize: number | undefined;
      let attachmentType: string | undefined;

      // Upload image if selected
      if (selectedImage) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data:image/...;base64, prefix
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });

        // Upload to UploadThing
        const uploadResult = await uploadFile({
          fileData: base64,
          fileName: selectedImage.name,
          fileType: selectedImage.type,
          fileSize: selectedImage.size,
          category: "image",
        });

        if (!uploadResult.success) {
          throw new Error("Failed to upload image");
        }

        attachmentUrl = uploadResult.file.url;
        attachmentName = uploadResult.file.name;
        attachmentSize = uploadResult.file.size;
        attachmentType = selectedImage.type;
      }

      await sendMessage({
        conversationId: conversation._id,
        content: messageContent,
        attachmentUrl,
        attachmentName,
        attachmentSize,
        attachmentType,
        experienceId,
      });

      handleRemoveImage();
      toast.success(
        selectedImage ? "Message with attachment sent!" : "Message sent!"
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessage(messageContent); // Restore message on error
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setSelectedImage(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachClick = () => {
    if (isSending || isUploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  // Scroll handler
  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // Check if near bottom (within 100px)
    isNearBottomRef.current = distanceFromBottom < 100;

    // Load more when scrolling to top (within 100px)
    if (scrollTop < 100 && hasMoreMessages && !isLoadingOlder) {
      loadOlderMessages();
    }
  };

  // Switch from pre-fetched to live messages when live messages are available
  useEffect(() => {
    if (liveMessages && liveMessages.length > 0) {
      setAllMessages(liveMessages);
      setHasMoreMessages(liveMessages.length === 50);
    }
  }, [liveMessages]);

  // Handle older messages when they load
  useEffect(() => {
    if (olderMessages !== undefined) {
      // Query completed (either with results or empty)
      setIsLoadingOlder(false);

      if (olderMessages.length === 0) {
        // No more messages found
        setHasMoreMessages(false);
      } else if (olderMessages.length > 0) {
        // Messages found - add them
        if (olderMessages.length < 50) {
          setHasMoreMessages(false); // This was the last batch
        }

        // Prepend older messages to existing ones, deduplicating by ID
        setAllMessages((prev) => {
          const combined = [...olderMessages, ...prev];
          const unique = combined.filter(
            (msg, index, self) =>
              index === self.findIndex((m) => m._id === msg._id)
          );
          return unique;
        });
      }
    }
  }, [olderMessages]);

  // Scroll position preservation when loading older messages
  useEffect(() => {
    if (!scrollRef.current || !isLoadingOlder) return;

    const previousHeight = previousScrollHeightRef.current;
    const currentHeight = scrollRef.current.scrollHeight;

    if (previousHeight && currentHeight > previousHeight) {
      scrollRef.current.scrollTop = currentHeight - previousHeight;
    }
  }, [isLoadingOlder, allMessages.length]);

  // Smart initial scroll
  useEffect(() => {
    if (!scrollRef.current || !allMessages.length) return;

    if (isInitialLoadRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isInitialLoadRef.current = false;
          }
        });
      });
    } else if (isNearBottomRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [allMessages]);

  // Auto-scroll when typing indicators appear
  useEffect(() => {
    if (isAITyping || isAgentTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isAITyping, isAgentTyping]);

  // Initialize presence on mount (cache the ID)
  useEffect(() => {
    if (!userId || presenceReady) return;

    updatePresence({
      userId: userId as Id<"users">,
      companyId: conversation.companyId as Id<"companies">,
      userRole: "customer",
      viewingConversation: conversation._id as Id<"conversations">,
    })
      .then((id) => {
        setPresenceId(id);
        setPresenceReady(true);
      })
      .catch((error) => console.error("Failed to initialize presence:", error));
  }, [userId, presenceReady, updatePresence, conversation._id]);

  // Presence heartbeat (now using lightweight mutation)
  useEffect(() => {
    if (!presenceId || !presenceReady) return;

    const interval = setInterval(() => {
      heartbeat({
        presenceId,
        viewingConversation: conversation._id as Id<"conversations">,
      }).catch((error) => {
        // If heartbeat fails, presence was deleted - reinitialize
        console.error("Heartbeat failed, reinitializing:", error);
        setPresenceReady(false);
        setPresenceId(null);
      });
    }, 60000); // Increased to 60 seconds

    return () => {
      clearInterval(interval);
      // Final heartbeat to clear viewing conversation
      if (presenceId) {
        heartbeat({
          presenceId,
          viewingConversation: undefined,
        });
      }
    };
  }, [presenceId, presenceReady, heartbeat, conversation._id]);

  // Mark messages as read by customer
  useEffect(() => {
    if (allMessages && allMessages.length > 0 && userId) {
      markAsRead({
        conversationId: conversation._id as Id<"conversations">,
        customerId: userId as Id<"users">,
      });
    }
  }, [allMessages, markAsRead, conversation._id, userId]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        <div className="max-w-[800px] mx-auto text-body-sm">
          {allMessages && allMessages.length > 0 ? (
            <>
              {/* Loading older messages indicator */}
              {isLoadingOlder && (
                <div className="flex justify-center my-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-caption">
                      Loading older messages...
                    </span>
                  </div>
                </div>
              )}

              {/* Beginning of conversation indicator */}
              {!hasMoreMessages && !isLoadingOlder && (
                <div className="flex justify-center my-6">
                  <div className="bg-muted/50 text-muted-foreground px-3 py-1.5 rounded-full">
                    • Beginning of conversation •
                  </div>
                </div>
              )}

              {/* Messages */}
              {allMessages.map((msg) => (
                <MessageBubble
                  key={msg._id}
                  message={transformMessage(msg)}
                  viewType="customer"
                  currentUserId={userId}
                />
              ))}

              {/* Typing Indicators */}
              {isAITyping && <TypingIndicator type="ai" viewType="customer" />}
              {isAgentTyping && (
                <TypingIndicator type="agent" viewType="customer" />
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <MessageListSkeleton />
          )}
        </div>
      </div>

      <div className="sticky bottom-0 bg-background px-4 pb-4">
        <div className="max-w-[800px] mx-auto">
          <Card className="px-4 py-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={isSending || isUploading}
              className="w-full min-h-[40px] max-h-[120px] resize-none border-0 text-body-sm px-0 py-0 placeholder:text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-default"
              rows={1}
            />

            {/* Image Preview */}
            {imagePreview && (
              <div className="mt-2">
                <div className="relative w-20 h-20 rounded-md overflow-hidden border">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 rounded">
                    {selectedImage?.name} (
                    {(() => {
                      const sizeKB = (selectedImage?.size || 0) / 1024;
                      if (sizeKB >= 1000) {
                        return `${(sizeKB / 1024).toFixed(1)} MB`;
                      }
                      return `${sizeKB.toFixed(1)} KB`;
                    })()}
                    )
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isSending || isUploading}
                onClick={handleAttachClick}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                onClick={handleSendMessage}
                disabled={
                  (!message.trim() && !selectedImage) ||
                  isSending ||
                  isUploading
                }
                size="icon"
                className="h-8 w-8"
              >
                {isSending || isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
