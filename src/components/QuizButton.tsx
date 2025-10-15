import React from "react";
import { Button } from "./ui/button";
import { BookOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { PersonaType } from "./PersonaSelector";

interface QuizButtonProps {
  onStartQuiz: () => void;
  currentPersona: PersonaType;
  className?: string;
}

const QuizButton = ({
  onStartQuiz,
  currentPersona,
  className = "",
}: QuizButtonProps) => {
  const getQuizTitle = (persona: PersonaType): string => {
    switch (persona) {
      case "greenbot":
        return "General Sustainability Quiz";
      case "lifestyle":
        return "Eco-Lifestyle Quiz";
      case "waste":
        return "Waste Management Quiz";
      case "nature":
        return "Biodiversity Quiz";
      case "energy":
        return "Energy Efficiency Quiz";
      case "climate":
        return "Climate Action Quiz";
      default:
        return "Environmental Quiz";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onStartQuiz}
            variant="outline"
            size="sm"
            className={`bg-[#98C9A3]/20 text-[#2C4A3E] border-[#8BA888]/40 hover:bg-[#98C9A3]/30 hover:text-[#2C4A3E] dark:bg-[#2C4A3E]/20 dark:text-[#98C9A3] dark:border-[#98C9A3]/40 dark:hover:bg-[#2C4A3E]/30 dark:hover:text-[#98C9A3] ${className}`}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Take the {getQuizTitle(currentPersona)}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Test your knowledge with a short quiz about this topic!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default QuizButton;
