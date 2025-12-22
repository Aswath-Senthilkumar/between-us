import { Heart, Lock, Unlock } from "lucide-react";
import type { Puzzle } from "../types";
import { getLocalDate } from "../utils/date";

interface PuzzleCardProps {
  puzzle: Puzzle;
  type: "received" | "sent";
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export default function PuzzleCard({
  puzzle,
  type,
  isFavorite,
  onToggleFavorite,
  onClick,
}: PuzzleCardProps) {
  const formattedDate = getLocalDate();
  const isToday = puzzle.date === formattedDate;

  return (
    <div
      onClick={onClick}
      className={`sketched-box p-4 flex items-center justify-between transition-colors relative group ${
        isToday
          ? "border-2 border-ink"
          : "border border-gray-300 opacity-80 hover:opacity-100"
      } ${type === "received" ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      <div className="flex-1 min-w-0 pr-2">
        {" "}
        {/* Pr-2 for spacing */}
        <div className="font-bold text-lg">{puzzle.date}</div>
        <div className="text-sm opacity-60">
          {type === "sent" ? (
            <div className="flex flex-col gap-1 mt-1">
              <span className="font-bold">Word: {puzzle.target_word}</span>
              <span className="flex items-center gap-1">
                <span className="font-bold">Message:</span>
                <span className="italic truncate">
                  "{puzzle.secret_message}"
                </span>
              </span>
            </div>
          ) : puzzle.is_solved ? (
            <span className="truncate block">"{puzzle.secret_message}"</span>
          ) : puzzle.guesses && puzzle.guesses.length >= 6 ? (
            puzzle.message_revealed ? (
              "Message Unlocked"
            ) : puzzle.message_requested ? (
              "Failed • Request Sent"
            ) : (
              "Failed"
            )
          ) : (
            "Unsolved"
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between self-stretch pl-4">
        <button
          onClick={onToggleFavorite}
          className="hover:scale-110 transition-transform"
        >
          <Heart
            size={20}
            className={`text-ink ${
              isFavorite ? "fill-accent-pink" : "fill-transparent"
            }`}
          />
        </button>

        <div className="pointer-events-none">
          {puzzle.is_solved || puzzle.message_revealed ? (
            <Unlock className="text-green-600 wobbly-icon" size={20} />
          ) : puzzle.guesses && puzzle.guesses.length >= 6 ? (
            <Lock className="text-red-500 wobbly-icon" size={20} />
          ) : (
            <Lock className="text-gray-400" size={20} />
          )}
        </div>
      </div>
    </div>
  );
}
