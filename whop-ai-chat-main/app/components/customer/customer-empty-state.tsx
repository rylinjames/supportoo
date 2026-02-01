"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Send, Paperclip, Lightbulb, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { usePreventZoom } from "@/app/hooks/use-prevent-zoom";

interface CustomerEmptyStateProps {
  userId: string;
  companyId: string;
  experienceId: string;
}

export function CustomerEmptyState({
  userId,
  companyId,
  experienceId,
}: CustomerEmptyStateProps) {
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = usePreventZoom<HTMLInputElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createConversation = useMutation(
    api.conversations.mutations.createCustomerConversation
  );
  const sendMessage = useMutation(api.messages.mutations.sendCustomerMessage);
  const uploadFile = useAction(api.uploadthing.actions.uploadFile);

  // Fetch company data to get company name
  const company = useQuery(
    api.companies.queries.getCompanyById,
    companyId ? { companyId: companyId as Id<"companies"> } : "skip"
  );

  // Use company name from Convex query, show generic text while loading
  const companyName = company?.name || "";

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendFirstMessage = async () => {
    if (!message.trim() && !selectedImage) return;

    const messageContent = message.trim();
    setMessage("");
    setIsCreating(true);
    setIsUploading(true);

    try {
      const conversationId = await createConversation({
        customerId: userId as Id<"users">,
        companyId: companyId as Id<"companies">,
      });

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
        conversationId,
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
      console.error(error);
      setMessage(messageContent); // Restore message on error
      toast.error("Failed to send message");
    } finally {
      setIsCreating(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendFirstMessage();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setMessage(question);
    setPopoverOpen(false);
    inputRef.current?.focus();
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
    if (isCreating || isUploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const suggestedQuestions = [
    "How do I get started?",
    "I need help with billing",
    "What features are available?",
    "How do I contact support?",
  ];

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="w-full max-w-[680px] px-6">
        {/* Logo/Heading */}
        <h1
          className="text-center mb-6 capitalize text-[40px] text-[#333] dark:text-white font-regular tracking-tight"
          style={{
            fontFamily:
              "var(--font-outfit), var(--font-geist-sans), sans-serif",
          }}
        >
          {companyName ? `${companyName} Support` : "Support"}
        </h1>

        {/* White Box Container */}
        <Card className="px-4 pt-1 pb-3">
          {/* Input Row */}
          <div className="mb-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={companyName ? `Ask anything about ${companyName}, we're here to help!` : "Ask us anything, we're here to help!"}
              disabled={isCreating || isUploading}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:bg-transparent dark:focus-visible:bg-transparent text-body-sm px-0 py-0 placeholder:text-body"
            />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-2">
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

          {/* Icons Row */}
          <div className="flex items-center justify-between -mx-2">
            {/* Left: Lightbulb */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Lightbulb className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div className="space-y-1">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestedQuestion(question)}
                      className="w-full justify-start text-body-sm h-8"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Right: Attachment + Send */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isCreating || isUploading}
                onClick={handleAttachClick}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendFirstMessage}
                disabled={
                  (!message.trim() && !selectedImage) ||
                  isCreating ||
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
            </div>
          </div>
        </Card>
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
