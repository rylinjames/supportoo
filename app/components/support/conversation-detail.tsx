"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { usePreventZoom } from "@/app/hooks/use-prevent-zoom";
import { useSoundNotifications } from "@/app/hooks/use-sound-notifications";
import { useConversationShortcuts } from "@/app/hooks/use-keyboard-shortcuts";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Paperclip,
  Send,
  MoreVertical,
  MessageSquareMore,
  X,
  Loader2,
  Bot,
  Download,
  Volume2,
  VolumeX,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  MessageBubble,
  type Message as MessageBubbleMessage,
} from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { CustomerProfileModal } from "./customer-profile-modal";
import { EnhancedQuickReplyPicker } from "./enhanced-quick-reply-picker";
import { InternalNotes } from "./internal-notes";
import { AgentPhrasesManager } from "./agent-phrases-manager";
import type { QuickReplyTemplate } from "./quick-reply-picker";
import { KeyboardShortcutsDialog } from "@/app/components/ui/keyboard-shortcuts-dialog";
import { MessageListSkeleton } from "./message-skeleton";
import { UserPresenceAvatar } from "@/components/animate-ui/user-presence-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Conversation } from "./types";
import { Id } from "@/convex/_generated/dataModel";

interface ConversationDetailProps {
  conversation: Conversation;
  onBack: () => void;
  messages?: Message[]; // Pre-fetched messages from conversation list
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
  agentAvatar?: string; // Added for avatar URL
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

interface TypingUser {
  userId: string;
  userRole: string;
  displayName: string;
  avatarUrl?: string;
  typingStartedAt: number;
}

export function ConversationDetail({
  conversation,
  onBack,
  messages: preFetchedMessages,
}: ConversationDetailProps) {
  const [message, setMessage] = useState("");
  const [presenceReady, setPresenceReady] = useState(false);
  const [presenceId, setPresenceId] = useState<Id<"presence"> | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [showHandBackDialog, setShowHandBackDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = usePreventZoom<HTMLTextAreaElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convex = useConvex();
  const { playSound, enabled: soundEnabled, setEnabled: setSoundEnabled } = useSoundNotifications();

  // Get current user for agentId
  const { userData } = useUser();

  // Get customer's last active timestamp (only if we have a valid Convex ID)
  // Convex IDs have format like "j57..." for users table
  const isValidConvexId = conversation.customerId && 
    typeof conversation.customerId === 'string' && 
    conversation.customerId.length > 10 &&
    /^[a-z0-9]+$/i.test(conversation.customerId);
    
  const customerLastActive = useQuery(
    api.users.activity.getLastActive, 
    isValidConvexId
      ? { userId: conversation.customerId as Id<"users"> }
      : "skip"
  );

  // Query usage limit status
  const usageLimitStatus = useQuery(
    api.usage.queries.checkUsageLimit,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Typing timeout ref
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // WhatsApp-style hybrid approach: Start with pre-fetched, then use live query
  const [allMessages, setAllMessages] = useState<Message[]>(
    preFetchedMessages || []
  );
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [beforeTimestamp, setBeforeTimestamp] = useState<number | undefined>(
    undefined
  );

  // Live query for real-time updates (latest 50 messages)
  const liveMessages = useQuery(api.messages.queries.getMessages, {
    conversationId: conversation.id as any,
    limit: 50,
  }) as Message[] | undefined;

  // Query for older messages when needed
  const olderMessages = useQuery(
    api.messages.queries.getMessages,
    beforeTimestamp
      ? {
          conversationId: conversation.id as any,
          before: beforeTimestamp,
          limit: 50,
        }
      : "skip"
  ) as Message[] | undefined;

  // Track previous message count for sound notifications
  const previousMessageCountRef = useRef(preFetchedMessages?.length || 0);

  // Switch from pre-fetched to live messages when live messages are available
  useEffect(() => {
    if (liveMessages && liveMessages.length > 0) {
      // Check if we have new messages (from customers)
      if (liveMessages.length > previousMessageCountRef.current) {
        // Check the newest messages to see if any are from customers
        const newMessageCount = liveMessages.length - previousMessageCountRef.current;
        const newestMessages = liveMessages.slice(-newMessageCount);
        
        // Play sound for new customer messages (not our own messages)
        const hasNewCustomerMessage = newestMessages.some(
          msg => msg.role === 'customer' && 
          msg.timestamp > (Date.now() - 5000) // Message is from last 5 seconds
        );
        
        if (hasNewCustomerMessage) {
          playSound('newMessage');
        }
      }
      
      previousMessageCountRef.current = liveMessages.length;
      setAllMessages(liveMessages);
      setHasMoreMessages(liveMessages.length === 50); // CRITICAL: Set this to show "Beginning of conversation"
    }
  }, [liveMessages, playSound]);

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

  // Fetch company plan to check attachment permissions
  const companyConfig = useQuery(
    api.companies.queries.getFullCompanyConfig,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as any }
      : "skip"
  );

  // Fetch templates for quick replies
  const templates = useQuery(
    api.templates.queries.listTemplatesByCompany,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  ) as QuickReplyTemplate[] | undefined;

  // Fetch typing indicators from other agents
  const typingUsers = useQuery(
    api.presence.queries.getConversationPresence,
    userData?.user._id
      ? {
          conversationId: conversation.id as Id<"conversations">,
          excludeUserId: userData.user._id as Id<"users">, // Hide our own typing in production
        }
      : "skip"
  ) as TypingUser[] | undefined; // Add type cast

  // Get agents currently viewing this conversation
  const viewingAgentIds = useQuery(
    api.presence.queries.getViewingAgents,
    conversation.id
      ? { conversationId: conversation.id as Id<"conversations"> }
      : "skip"
  );

  // Check if user can attach files
  const canAttachFiles =
    companyConfig?.plan?.hasFileAttachments ||
    process.env.NODE_ENV === "development";

  // Mark messages as read by agent
  const markAsRead = useMutation(
    api.messages.mutations.markMessagesAsReadByAgent
  );

  // Send agent message
  const sendMessage = useMutation(api.messages.mutations.sendAgentMessage);

  // Upload file
  const uploadFile = useAction(api.uploadthing.actions.uploadFile);

  // Mark conversation as resolved
  const markAsResolved = useMutation(
    api.conversations.mutations.markIssueResolved
  );

  // Hand back to AI
  const handBackToAI = useMutation(api.conversations.mutations.updateStatus);

  // Delete conversation
  const deleteConversation = useMutation(
    api.conversations.mutations.deleteConversation
  );

  // Typing indicator
  const setTyping = useMutation(api.presence.mutations.setTyping);
  const updatePresence = useMutation(api.presence.mutations.updatePresence);
  const heartbeat = useMutation(api.presence.mutations.heartbeat);

  // Track if this is the initial load
  // Scroll state management (following design pattern)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showNewMessageBadge, setShowNewMessageBadge] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const previousScrollHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is near bottom
  const checkIfNearBottom = () => {
    if (!scrollRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const near = distanceFromBottom < 100; // Within 100px of bottom

    setIsNearBottom(near);
    isNearBottomRef.current = near;

    if (near) {
      setShowNewMessageBadge(false);
    }

    return near;
  };

  // Load older messages function
  const loadOlderMessages = () => {
    if (!allMessages.length || !hasMoreMessages || isLoadingOlder) return;

    setIsLoadingOlder(true);

    const oldestMessage = allMessages[0];

    // Store current scroll height to maintain position
    previousScrollHeightRef.current = scrollRef.current?.scrollHeight || 0;

    // Trigger the older messages query
    setBeforeTimestamp(oldestMessage.timestamp);
  };

  // Handle scroll events
  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop } = scrollRef.current;

    // Check if near bottom
    checkIfNearBottom();

    // Load more when scrolling to top (within 100px)
    if (scrollTop < 100 && hasMoreMessages && !isLoadingOlder) {
      loadOlderMessages();
    }
  };

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

  // Scroll position preservation when loading older messages
  useEffect(() => {
    if (!scrollRef.current || !isLoadingOlder) return;

    const previousHeight = previousScrollHeightRef.current;
    const currentHeight = scrollRef.current.scrollHeight;

    if (previousHeight && currentHeight > previousHeight) {
      scrollRef.current.scrollTop = currentHeight - previousHeight;
    }
  }, [isLoadingOlder, allMessages.length]);

  // Auto-scroll when typing indicators appear
  useEffect(() => {
    if (typingUsers && typingUsers.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [typingUsers]);

  const scrollToBottom = () => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });

    setShowNewMessageBadge(false);
  };

  // Initialize presence on mount with viewing conversation
  useEffect(() => {
    if (userData?.user._id && userData?.currentCompanyId && !presenceReady) {
      updatePresence({
        userId: userData.user._id as Id<"users">,
        companyId: userData.currentCompanyId as Id<"companies">,
        userRole: userData.userCompanies.find(
          (uc) => uc.companyId === userData.currentCompanyId
        )?.role as "admin" | "support",
        viewingConversation: conversation.id as Id<"conversations">, // NEW
      })
        .then((id) => {
          setPresenceId(id);
          setPresenceReady(true);
        })
        .catch((error) => {
          console.error("Failed to initialize presence:", error);
          // Retry after a delay
          setTimeout(() => {
            if (!presenceReady) {
              updatePresence({
                userId: userData.user._id as Id<"users">,
                companyId: userData.currentCompanyId as Id<"companies">,
                userRole: userData.userCompanies.find(
                  (uc) => uc.companyId === userData.currentCompanyId
                )?.role as "admin" | "support",
                viewingConversation: conversation.id as Id<"conversations">, // NEW
              })
                .then((id) => {
                  setPresenceId(id);
                  setPresenceReady(true);
                })
                .catch((retryError) => {
                  console.error(
                    "Failed to initialize presence on retry:",
                    retryError
                  );
                });
            }
          }, 1000);
        });
    }
  }, [
    userData?.user._id,
    userData?.currentCompanyId,
    presenceReady,
    updatePresence,
    conversation.id,
  ]);

  // Update presence heartbeat with viewing info (now using lightweight mutation)
  useEffect(() => {
    if (!presenceId || !presenceReady) return;

    // Heartbeat every 60 seconds
    const interval = setInterval(() => {
      heartbeat({
        presenceId,
        viewingConversation: conversation.id as Id<"conversations">,
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
  }, [presenceId, presenceReady, heartbeat, conversation.id]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Mark messages as read when component mounts
  useEffect(() => {
    if (allMessages && allMessages.length > 0 && userData?.user._id) {
      markAsRead({
        conversationId: conversation.id as Id<"conversations">,
        agentId: userData.user._id as Id<"users">,
      });
    }
  }, [allMessages, markAsRead, conversation.id, userData?.user._id]);

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedImage) return;

    const messageContent = message.trim();
    setMessage("");

    // Clear typing status when sending message
    if (userData?.user._id && presenceReady) {
      setTyping({
        userId: userData.user._id as Id<"users">,
        conversationId: conversation.id as Id<"conversations">,
        isTyping: false,
      });
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setIsUploading(true);

    try {
      if (!userData?.user._id) {
        throw new Error("No agent ID available");
      }

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

      // Send message with optional attachment
      await sendMessage({
        conversationId: conversation.id as Id<"conversations">,
        content: messageContent,
        agentId: userData.user._id as Id<"users">,
        attachmentUrl,
        attachmentName,
        attachmentSize,
        attachmentType,
      });

      // Play sound on successful send
      playSound('messageSent');

      // Clear image after successful send
      handleRemoveImage();
      toast.success(
        selectedImage ? "Message with attachment sent!" : "Message sent!"
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      playSound('error');
      setMessage(messageContent); // Restore message on error
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkAsResolved = async () => {
    if (!userData?.user._id) return;

    try {
      await markAsResolved({
        conversationId: conversation.id as Id<"conversations">,
        agentId: userData.user._id as Id<"users">,
        resolvedBy: "agent",
      });
      setShowResolveDialog(false);
      toast.success("Conversation marked as resolved");
    } catch (error) {
      console.error("Failed to mark conversation as resolved:", error);
      toast.error("Failed to mark conversation as resolved");
    }
  };

  // File handling functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 2MB");
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

  const handleTemplateSelect = (content: string) => {
    // If the message starts with "/", replace it with the template content
    // Otherwise just set the content normally
    if (message.trim() === '/' || message.endsWith(' /') || message.endsWith('\n/')) {
      // Remove the trailing "/" and add the template content
      const messageWithoutSlash = message.slice(0, -1);
      setMessage(messageWithoutSlash + content);
    } else {
      setMessage(content);
    }
    setShowQuickReplyPicker(false);
    // Focus the textarea after selecting a template
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleExportConversation = async () => {
    try {
      const exportData = await convex.query(api.conversations.export.exportConversationToCSV, {
        conversationId: conversation.id as Id<"conversations">,
      });
      
      // Create blob and download
      const blob = new Blob([exportData.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversation.customerName}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Conversation exported to CSV");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export conversation");
    }
  };

  const handleHandBackToAI = async () => {
    try {
      await handBackToAI({
        conversationId: conversation.id as Id<"conversations">,
        status: "ai_handling",
        agentId: userData?.user._id as Id<"users">,
        agentName: userData?.user.displayName || "Support staff",
      });
      setShowHandBackDialog(false);
      toast.success("Conversation handed back to AI");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to hand back to AI";
      toast.error(errorMessage);
      setShowHandBackDialog(false);
    }
  };

  const handleDeleteConversation = async () => {
    setIsDeleting(true);
    try {
      await deleteConversation({
        conversationId: conversation.id as Id<"conversations">,
      });
      setShowDeleteDialog(false);
      toast.success("Conversation deleted");
      onBack(); // Go back to conversation list
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAttachClick = () => {
    if (!canAttachFiles) {
      toast.info("File attachments are only available on Pro and Elite plans");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Check if user typed "/" at the beginning or after a space/newline
    const cursorPosition = e.target.selectionStart;
    const charBeforeCursor = cursorPosition > 0 ? newValue[cursorPosition - 2] : '';
    const charAtCursor = newValue[cursorPosition - 1];
    
    if (charAtCursor === '/' && (cursorPosition === 1 || charBeforeCursor === ' ' || charBeforeCursor === '\n')) {
      // Open quick reply picker
      setShowQuickReplyPicker(true);
    }

    // Set typing status immediately when user starts typing
    if (userData?.user._id && presenceReady) {
      setTyping({
        userId: userData.user._id as Id<"users">,
        conversationId: conversation.id as Id<"conversations">,
        isTyping: true,
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (userData?.user._id && presenceReady) {
        setTyping({
          userId: userData.user._id as Id<"users">,
          conversationId: conversation.id as Id<"conversations">,
          isTyping: false,
        });
      }
    }, 3000);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastSeenText = (timestamp: number | null | undefined): string => {
    if (!timestamp) return "Never seen";
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // If active in last 5 minutes
    if (diff < 5 * 60 * 1000) {
      return "Active now";
    }
    
    // If active in last hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `Active ${minutes}m ago`;
    }
    
    // Otherwise show relative time
    return `Last seen ${formatDistanceToNow(timestamp, { addSuffix: true })}`;
  };

  // Setup keyboard shortcuts (after all handlers are defined)
  useConversationShortcuts(
    handleSendMessage,
    () => setShowResolveDialog(true),
    handleExportConversation,
    undefined // We don't have a toggle for notes yet
  );

  // Transform backend messages to MessageBubble format
  const transformMessage = (msg: Message): MessageBubbleMessage => {
    return {
      id: msg._id,
      type: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      agentId: msg.agentId, // Add agentId for "You" logic
      agentName: msg.agentName,
      agentAvatar: msg.agentAvatar, // Use the enriched agentAvatar from the query
      readByCustomerAt: msg.readByCustomerAt, // Add read receipt fields
      readByAgentAt: msg.readByAgentAt, // Add read receipt fields
      attachment: msg.attachmentUrl
        ? {
            name: msg.attachmentName || "image",
            size: msg.attachmentSize || 0,
            type: msg.attachmentType || "image/jpeg",
            url: msg.attachmentUrl,
          }
        : undefined,
    };
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background text-body-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="p-0 h-auto hover:bg-transparent"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to conversations</p>
              </TooltipContent>
            </Tooltip>

            <Avatar className="h-8 w-8 xl:h-10 xl:w-10">
              <AvatarImage src={conversation.customerAvatar} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {getInitials(conversation.customerName)}
              </AvatarFallback>
            </Avatar>

            <div>
              <h2 className="text-foreground">{conversation.customerName}</h2>
              <p className="text-muted-foreground">
                @{conversation.customerUsername} • {getLastSeenText(customerLastActive)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Handling agents display - hidden on mobile */}
            {conversation.status === "support" &&
              conversation.participatingAgents.length > 0 && (
                <>
                  <span className="hidden xl:inline text-label-sm text-muted-foreground">
                    Handling:
                  </span>
                  <div className="hidden xl:flex">
                    <UserPresenceAvatar
                      users={conversation.participatingAgents.map((agent) => ({
                        id: agent.id,
                        src: agent.avatar,
                        fallback: agent.initials,
                        tooltip: agent.name,
                        online:
                          viewingAgentIds?.includes(agent.id as Id<"users">) ||
                          false,
                      }))}
                      size="sm"
                    />
                  </div>
                </>
              )}

            <div className="hidden xl:block text-muted-foreground text-body-sm">
              Started{" "}
              {formatDistanceToNow(conversation.createdAt, { addSuffix: true })}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{soundEnabled ? 'Mute sounds' : 'Enable sounds'}</p>
              </TooltipContent>
            </Tooltip>

            <KeyboardShortcutsDialog />

            {/* Resolve Button - Prominent! */}
            {conversation.status !== "resolved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResolveDialog(true)}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Resolve
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowCustomerProfile(true)}>
                  View customer profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportConversation()}>
                  <Download className="h-4 w-4 mr-2" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Internal Notes Section - Only visible to agents */}
        {conversation.id && (
          <div className="px-4 py-3 border-b border-border">
            <InternalNotes conversationId={conversation.id as Id<"conversations">} />
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto p-4"
        >
          <div className="max-w-[800px] mx-auto">
            {/* Beginning of conversation indicator */}

            {/* Messages */}
            {allMessages && allMessages.length > 0 ? (
              <>
                {/* Loading older messages indicator */}
                {isLoadingOlder && (
                  <div className="flex justify-center my-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-body-sm">
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

                {allMessages.map((msg, index) => (
                  <MessageBubble
                    key={msg._id}
                    message={transformMessage(msg)}
                    viewType="support"
                    currentUserId={userData?.user._id}
                  />
                ))}
              </>
            ) : (
              <MessageListSkeleton />
            )}

            {/* Typing Indicators */}
            {typingUsers?.map((typingUser: TypingUser) => (
              <TypingIndicator
                key={typingUser.userId}
                type="agent"
                agentName={typingUser.displayName}
                agentAvatar={typingUser.avatarUrl} // Use actual avatar instead of undefined
                viewType="support"
                currentUserId={userData?.user._id}
              />
            ))}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* New message badge */}
        {showNewMessageBadge && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
            <button
              onClick={scrollToBottom}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
            >
              New message
            </button>
          </div>
        )}

        {/* Message Composer */}
        <div className="sticky bottom-0 z-20 bg-background">
          {/* Composer */}
          <div className="px-4 pb-4">
            <div className="max-w-[800px] mx-auto">
              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-3 relative">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="rounded-lg max-w-full h-auto max-h-[50px] object-cover"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveImage}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Card className="px-4 py-3">
                {/* Input Row */}
                <div>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleTyping}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      conversation.status === "resolved"
                        ? "Conversation is resolved - customer must start a new chat to continue"
                        : "Type a message... (Press / for quick replies)"
                    }
                    disabled={conversation.status === "resolved"}
                    className="w-full min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent text-body-sm px-0 py-0 placeholder:text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-default"
                    rows={1}
                  />
                </div>

                {/* Icons Row */}
                <div className="flex items-center justify-between -mx-2 mt-1">
                  {/* Left: Quick Replies + Hand Back to AI */}
                  <div className="flex items-center gap-1">
                    {/* Quick Reply Templates */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Popover
                          open={showQuickReplyPicker}
                          onOpenChange={setShowQuickReplyPicker}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={conversation.status === "resolved"}
                            >
                              <MessageSquareMore className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[calc(100vw-2rem)] max-w-[400px] p-0"
                            align="start"
                          >
                            <EnhancedQuickReplyPicker
                              onSelect={handleTemplateSelect}
                              templates={templates}
                              isLoading={templates === undefined}
                            />
                          </PopoverContent>
                        </Popover>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Quick reply templates</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Agent Phrases Manager */}
                    <div className="ml-1">
                      <AgentPhrasesManager />
                    </div>

                    {/* Hand Back to AI - Only show if conversation is in support status */}
                    {conversation.status === "support" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowHandBackDialog(true)}
                            disabled={
                              usageLimitStatus?.hasReachedLimit || false
                            }
                          >
                            <Bot className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {usageLimitStatus?.hasReachedLimit
                              ? "AI usage limit reached"
                              : "Hand back to AI"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Right: Attachment + Send */}
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={
                            conversation.status === "resolved" ||
                            !canAttachFiles
                          }
                          onClick={handleAttachClick}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {canAttachFiles
                            ? "Attach image"
                            : "File attachments not available"}
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSendMessage}
                          disabled={
                            (!message.trim() && !selectedImage) ||
                            conversation.status === "resolved" ||
                            isUploading
                          }
                          size="icon"
                          className="h-8 w-8"
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isUploading ? "Sending..." : "Send message"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Mark as Resolved Confirmation Dialog */}
      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Resolved</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this conversation as resolved?
              Support staff will no longer be able to send messages. The
              customer will need to start a new chat to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsResolved}>
              Mark as Resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hand Back to AI Confirmation Dialog */}
      <AlertDialog
        open={showHandBackDialog}
        onOpenChange={setShowHandBackDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hand Back to AI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to hand this conversation back to AI? The AI
              will resume handling customer messages automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHandBackToAI}>
              Hand Back to AI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot
              be undone. All messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Profile Modal */}
      <CustomerProfileModal
        isOpen={showCustomerProfile}
        onClose={() => setShowCustomerProfile(false)}
        customerName={conversation.customerName}
        customerUsername={conversation.customerUsername}
        customerAvatar={conversation.customerAvatar}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </TooltipProvider>
  );
}

//agent: k9737j51dybk49m906d9yy4bv17sas0s conversation: jd76stavz43apacv78e6mxhjrs7sa4f3 company: j57ab9x0308dcejr6kd2asb4nx7s9tfv
