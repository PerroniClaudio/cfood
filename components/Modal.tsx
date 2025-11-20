"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export default function Modal({
  isOpen,
  onCloseAction,
  title,
  children,
  size = "lg",
}: ModalProps) {
  const getMaxWidth = () => {
    switch (size) {
      case "sm":
        return "max-w-sm";
      case "md":
        return "max-w-md";
      case "lg":
        return "max-w-2xl";
      case "xl":
        return "max-w-4xl";
      case "full":
        return "max-w-[95vw]";
      default:
        return "max-w-2xl";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className={`${getMaxWidth()} max-h-[90vh] flex flex-col p-0 gap-0`}>
        <DialogHeader className="p-6 pb-4 border-b-2 border-border">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6 max-h-[calc(90vh-80px)]">
          {children}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
