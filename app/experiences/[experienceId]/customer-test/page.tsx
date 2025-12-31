"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@/app/contexts/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, User, Bot, UserCheck, ArrowLeft, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CustomerTestPage() {
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData } = useUser();
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Create a test customer user
  const [testCustomerId, setTestCustomerId] = useState<Id<"users"> | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);

  // Get or create test customer
  const getOrCreateTestCustomer = useMutation(
    api.users.mutations.getOrCreateTestCustomer
  );

  // Create conversation for test customer
  const createConversation = useMutation(
    api.conversations.mutations.createCustomerConversation
  );

  // Send message mutation (this will trigger AI response automatically)
  const sendMessage = useMutation(api.messages.mutations.sendCustomerMessage);

  // Request human support
  const requestHuman = useMutation(
    api.conversations.mutations.requestHumanSupport
  );

  // Initialize conversation when component mounts
  const [testCustomerName, setTestCustomerName] = useState("Test Customer");
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize test customer and conversation on first mount only
  useEffect(() => {
    const initialize = async () => {
      if (!userData?.currentCompanyId) return;
      
      setIsLoading(true);
      try {
        // Get or create test customer
        const testCustomer = await getOrCreateTestCustomer({
          companyId: userData.currentCompanyId as Id<"companies">,
        });
        
        if (testCustomer) {
          setTestCustomerId(testCustomer._id);
          setTestCustomerName(testCustomer.displayName);
          
          // Only create conversation if we don't have one
          if (!conversationId) {
            const convId = await createConversation({
              customerId: testCustomer._id,
              companyId: userData.currentCompanyId as Id<"companies">,
              forceNew: false, // Don't force new on initial mount - reuse if exists
            });
            
            setConversationId(convId);
          }
        }
      } catch (error) {
        console.error("Error initializing test customer:", error);
        toast.error("Failed to initialize test customer");
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [userData?.currentCompanyId]); // Only depend on companyId change

  // Get conversation messages
  const messages = useQuery(
    api.messages.queries.getMessages,
    conversationId ? { conversationId } : "skip"
  );

  // Get conversation details
  const conversation = useQuery(
    api.conversations.queries.getConversation,
    conversationId ? { conversationId } : "skip"
  );

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !conversationId || !testCustomerId) return;

    const message = messageInput.trim();
    setMessageInput("");
    setIsTyping(true);

    try {
      await sendMessage({
        conversationId,
        content: message,
        experienceId, // Pass the experience ID for AI config
      });
      // AI will respond automatically after a short delay
      setTimeout(() => setIsTyping(false), 2000); // Show typing indicator for 2 seconds
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setIsTyping(false);
    }
  };

  const handleRequestHuman = async () => {
    if (!conversationId || !testCustomerId) return;

    try {
      await requestHuman({
        conversationId,
        customerId: testCustomerId,
      });
      toast.success("Requested human support");
    } catch (error) {
      console.error("Error requesting human:", error);
      toast.error("Failed to request human support");
    }
  };

  // Create new conversation
  const handleNewConversation = async () => {
    if (!userData?.currentCompanyId || !testCustomerId) return;

    try {
      // Create a new conversation (force new for test customer)
      const newConvId = await createConversation({
        customerId: testCustomerId,
        companyId: userData.currentCompanyId as Id<"companies">,
        forceNew: true, // Always create new for test customer
      });
      
      // Update the conversation ID to the new one
      setConversationId(newConvId);
      setIsTyping(false);
      setMessageInput("");
      
      toast.success("Started new conversation");
    } catch (error) {
      console.error("Error creating new conversation:", error);
      toast.error("Failed to start new conversation");
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/experiences/${experienceId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agent View
            </Button>
          </Link>
          <div className="border-l border-border pl-3">
            <h1 className="text-h3 text-foreground">Customer Test View</h1>
            <p className="text-body-sm text-muted-foreground">
              Testing as: {testCustomerName}
            </p>
          </div>
        </div>
        
        {/* Status Badge and New Conversation Button */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleNewConversation}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New Conversation
          </Button>
          
          {conversation?.status === "ai_handling" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full">
              <Bot className="h-4 w-4" />
              <span className="text-body-sm">AI Handling</span>
            </div>
          )}
          {conversation?.status === "available" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full">
              <User className="h-4 w-4" />
              <span className="text-body-sm">Waiting for Agent</span>
            </div>
          )}
          {conversation?.status === "support_staff_handling" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full">
              <UserCheck className="h-4 w-4" />
              <span className="text-body-sm">Agent Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages?.map((message: any) => {
            const isCustomer = message.role === "customer";
            const isSystem = message.role === "system";
            const isAgent = message.role === "agent";
            const isAI = message.role === "ai";

            return (
              <div
                key={message._id}
                className={`flex gap-3 ${isCustomer ? "justify-end" : "justify-start"}`}
              >
                {!isCustomer && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {isAgent && (
                      <>
                        <AvatarFallback className="bg-green-500 text-white">
                          {message.agentName?.split(" ")[0]?.[0] || "A"}
                        </AvatarFallback>
                      </>
                    )}
                    {isAI && (
                      <AvatarFallback className="bg-blue-500 text-white">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                    {isSystem && (
                      <AvatarFallback className="bg-muted">
                        <span className="text-xs">SYS</span>
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}

                <div className={`flex flex-col gap-1 max-w-md ${isCustomer ? "items-end" : "items-start"}`}>
                  {!isSystem && (
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-muted-foreground">
                        {isCustomer && "You"}
                        {isAgent && message.agentName}
                        {isAI && "Support Bot"}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  )}

                  <Card
                    className={`px-3 py-2 ${
                      isCustomer
                        ? "bg-primary text-primary-foreground"
                        : isSystem
                        ? "bg-muted border-0"
                        : "bg-card"
                    }`}
                  >
                    <p className={`text-body-sm ${isSystem ? "text-muted-foreground italic" : ""}`}>
                      {message.content}
                    </p>
                  </Card>
                </div>

                {isCustomer && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {testCustomerName?.[0] || "T"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-500 text-white">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <Card className="px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </Card>
            </div>
          )}
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          {conversation?.status === "ai_handling" && (
            <div className="mb-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestHuman}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Talk to a Human
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isLoading ? "Initializing..." : "Type your message..."}
              disabled={isTyping || isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || isTyping || !conversationId || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-caption text-muted-foreground text-center mt-2">
            This is a test customer view - messages sent here will appear in your Support dashboard
          </p>
        </div>
      </div>
    </div>
  );
}