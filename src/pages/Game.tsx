import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Unlock } from "lucide-react";
import type { Puzzle } from "../types";
import { getLocalDate } from "../utils/date";
import PageLayout from "../components/PageLayout";

const LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

export default function Game() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");

  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">(
    "playing"
  );

  // Fetch puzzle (today or specific date)
  // Fetch puzzle (today or specific date)
  useEffect(() => {
    if (!profile) return;
    const fetchPuzzle = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      // Use query param date OR today's date
      const targetDate = dateParam || getLocalDate();

      const { data } = await supabase
        .from("puzzles")
        .select("*")
        .in("solver_id", [profile.id])
        .eq("date", targetDate)
        .single();

      if (data) {
        setPuzzle(data);
        if (data.guesses) setGuesses(data.guesses);
        if (data.is_solved) setGameStatus("won");
        else if (data.guesses && data.guesses.length >= 6)
          setGameStatus("lost");
        else setGameStatus("playing");
      } else {
        setPuzzle(null);
      }
      if (showLoading) setLoading(false);
    };

    fetchPuzzle(true);

    // Subscribe to changes for this puzzle (mainly for message_revealed)
    const channel = supabase
      .channel("game-puzzle-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "puzzles",
          filter: `solver_id=eq.${profile.id}`,
        },
        () => {
          // Check if it matches current date logic, simplified: just refetch or update state
          // For simplicity and correctness, let's just refetch if we have a puzzle loaded
          fetchPuzzle(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, dateParam]);

  const saveProgress = useCallback(
    async (newGuesses: string[], solved: boolean) => {
      if (!puzzle) return;
      await supabase
        .from("puzzles")
        .update({
          guesses: newGuesses,
          is_solved: solved,
        })
        .eq("id", puzzle.id);
    },
    [puzzle]
  );

  const handleKeyPress = useCallback(
    async (key: string) => {
      if (gameStatus !== "playing" || !puzzle) return;

      if (key === "BACKSPACE") {
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }
      if (key === "ENTER") {
        if (currentGuess.length !== 5) return;

        const newGuesses = [...guesses, currentGuess];
        setGuesses(newGuesses);
        setCurrentGuess("");

        const won = currentGuess === puzzle.target_word;
        if (won) {
          setGameStatus("won");
          await saveProgress(newGuesses, true);
        } else if (newGuesses.length >= 6) {
          setGameStatus("lost");
          await saveProgress(newGuesses, false);
        } else {
          await saveProgress(newGuesses, false);
        }
        return;
      }
      if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
        setCurrentGuess((prev) => prev + key);
      }
    },
    [currentGuess, gameStatus, puzzle, guesses, saveProgress]
  );

  const handleRequestMessage = async () => {
    if (!puzzle) return;
    const { error } = await supabase
      .from("puzzles")
      .update({ message_requested: true })
      .eq("id", puzzle.id);

    if (!error) {
      setPuzzle({ ...puzzle, message_requested: true });
    }
  };

  // Physical Keyboard listener
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE" || /^[A-Z]$/.test(key)) {
        handleKeyPress(key);
      }
    };
    window.addEventListener("keyup", listener);
    return () => window.removeEventListener("keyup", listener);
  }, [handleKeyPress]);

  if (loading) return <div className="p-10 text-center">Loading puzzle...</div>;

  if (!puzzle) {
    return (
      <div className="p-10 flex flex-col items-center text-center">
        <Lock className="wobbly-icon h-16 w-16 mb-4 text-gray-400" />
        <h2>No puzzle yet!</h2>
        <p>Tell your partner to set the daily word.</p>
        <button onClick={() => navigate("/")} className="mt-6 sketched-btn">
          Back Home
        </button>
      </div>
    );
  }

  // Helper to get logic for a cell
  const getCellClass = (letter: string, index: number, rowIndex: number) => {
    // If current row being typed
    if (rowIndex === guesses.length) {
      return letter ? "border-ink animate-bounce" : "border-gray-300";
    }
    // If future row
    if (rowIndex > guesses.length) return "border-gray-200";

    // If past row - compute detailed Wordle logic
    const guess = guesses[rowIndex];
    const target = puzzle.target_word;

    // 1. Identify Greens (Correct Position)
    const targetChars: (string | null)[] = target.split("");
    const guessChars = guess.split("");
    const resultColors = Array(5).fill("gray"); // Default to gray

    // First pass: Mark Greens
    guessChars.forEach((char, i) => {
      if (char === targetChars[i]) {
        resultColors[i] = "green";
        targetChars[i] = null; // Remove from pool
      }
    });

    // Second pass: Mark Yellows
    guessChars.forEach((char, i) => {
      if (resultColors[i] !== "green") {
        const targetIndex = targetChars.indexOf(char);
        if (targetIndex !== -1) {
          resultColors[i] = "yellow";
          targetChars[targetIndex] = null; // Remove from pool
        }
      }
    });

    const color = resultColors[index];

    if (color === "green") return "bg-accent-green border-ink";
    if (color === "yellow") return "bg-accent-yellow border-ink";
    return "bg-gray-200 border-gray-400 opacity-50";
  };

  return (
    <PageLayout theme="pink" className="flex flex-col max-w-md mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate("/")} className="p-2">
          <ArrowLeft />
        </button>
        <div className="text-center">
          <h1 className="text-xl m-0">Daily Puzzle</h1>
          <p className="text-sm opacity-60 m-0">{puzzle.date}</p>
          {puzzle.hint && (
            <p className="text-sm text-accent-blue font-bold m-0 mt-1">
              Hint: {puzzle.hint}
            </p>
          )}
        </div>
        <div className="w-8"></div>
      </div>

      {/* Message Unlock Overlay or Section */}
      {gameStatus === "won" && (
        <div className="sketched-box bg-accent-pink/30 mb-4 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center gap-2 mb-2">
            <Unlock className="wobbly-icon" />
            <h3 className="m-0 font-bold">Secret Message:</h3>
          </div>
          <p className="font-hand text-xl whitespace-pre-wrap">
            {puzzle.secret_message}
          </p>
        </div>
      )}

      {gameStatus === "lost" && (
        <div className="sketched-box bg-gray-200 mb-4 text-center">
          <h3 className="text-red-500 font-bold mb-2">Game Over</h3>
          <p className="mb-2">
            The word was:{" "}
            <span className="font-mono font-bold tracking-widest">
              {puzzle.target_word}
            </span>
          </p>
          <div className="border-t border-gray-400 my-3 pt-2">
            {puzzle.message_revealed ? (
              <RenderRevealedMessage puzzle={puzzle} />
            ) : (
              <>
                <p className="text-sm opacity-70 mb-1">
                  You missed the hidden message!
                </p>
                {puzzle.message_requested ? (
                  <p className="font-bold text-accent-blue animate-pulse">
                    Request sent! Waiting for partner... ⏳
                  </p>
                ) : (
                  <button
                    onClick={handleRequestMessage}
                    className="sketched-btn bg-accent-blue text-sm py-1 px-4 mt-1"
                  >
                    Request Message 📬
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-grow flex flex-col items-center justify-center gap-2 mb-4">
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
          const isCurrentRow = rowIndex === guesses.length;
          const rowGuess = isCurrentRow
            ? currentGuess
            : guesses[rowIndex] || "";
          return (
            <div key={rowIndex} className="flex gap-2">
              {[0, 1, 2, 3, 4].map((colIndex) => (
                <div
                  key={colIndex}
                  className={`
                       w-12 h-12 sm:w-14 sm:h-14 
                       border-2 flex items-center justify-center 
                       text-2xl font-bold 
                       rounded-sm transition-colors duration-500
                       ${getCellClass(
                         rowGuess[colIndex] || "",
                         colIndex,
                         rowIndex
                       )}
                       ${isCurrentRow ? "border-dashed" : "border-solid"}
                     `}
                >
                  {rowGuess[colIndex]}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Keyboard */}
      <div className="w-full">
        {gameStatus === "playing" && (
          <div className="flex flex-wrap justify-center gap-1">
            {LETTERS.map((char) => (
              <button
                key={char}
                onClick={() => handleKeyPress(char)}
                className="p-2 sm:p-3 bg-white border border-ink rounded font-bold text-sm sm:text-base hover:bg-gray-100 active:scale-95 transition-transform"
              >
                {char}
              </button>
            ))}
            <button
              onClick={() => handleKeyPress("BACKSPACE")}
              className="p-2 px-4 bg-gray-200 border border-ink rounded"
            >
              ⌫
            </button>
            <button
              onClick={() => handleKeyPress("ENTER")}
              className="p-2 px-4 bg-accent-green border border-ink rounded"
            >
              ✓
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

// Helper component to handle side effect of marking as viewed
function RenderRevealedMessage({ puzzle }: { puzzle: Puzzle }) {
  useEffect(() => {
    if (puzzle.message_revealed && !puzzle.message_viewed) {
      supabase
        .from("puzzles")
        .update({ message_viewed: true })
        .eq("id", puzzle.id)
        .then();
    }
  }, [puzzle]);

  return (
    <div className="animate-in fade-in zoom-in duration-500">
      <p className="text-sm opacity-70 mb-1">Partner revealed the message!</p>
      <div className="bg-white/50 p-2 rounded mt-2">
        <p className="font-hand text-xl whitespace-pre-wrap">
          {puzzle.secret_message}
        </p>
      </div>
    </div>
  );
}
