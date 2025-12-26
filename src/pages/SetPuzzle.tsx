import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/useAuth";
import { ArrowLeft, Save } from "lucide-react";
import PageLayout from "../components/PageLayout";
import { getLocalDate } from "../utils/date";
import { withTimeout } from "../utils/async";

export default function SetPuzzle() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDuplicateError, setShowDuplicateError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [checkingHistory, setCheckingHistory] = useState(true);

  // Fetch previously used words on mount
  useEffect(() => {
    if (!profile) return;
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("puzzles")
        .select("target_word")
        .eq("setter_id", profile.id);

      if (data) {
        setUsedWords(data.map((p) => p.target_word));
      }
      setCheckingHistory(false);
    };
    fetchHistory();
  }, [profile]);

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.partner_id) return;
    if (word.length !== 5) return alert("Word must be 5 letters");

    if (checkingHistory)
      return alert("Still checking history... please wait a sec!");
    if (usedWords.includes(word.toUpperCase())) {
      setShowDuplicateError(true);
      return;
    }

    setShowConfirm(true);
  };

  const handleLockIn = async () => {
    if (!profile) return;
    setLoading(true);
    setShowConfirm(false);
    try {
      const today = getLocalDate();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await withTimeout<any>(
        supabase.from("puzzles").insert({
          date: today,
          setter_id: profile.id,
          solver_id: profile.partner_id,
          target_word: word.toUpperCase(),
          hint: hint || null,
          secret_message: message,
        }),
        15000,
        "Taking too long to lock in. Check connection?"
      );

      if (error) throw error;
      navigate("/");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      theme="pink"
      className="p-4 max-w-md mx-auto flex flex-col relative"
    >
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-black/5 rounded-full"
        >
          <ArrowLeft />
        </button>
        <h1>Set Daily Puzzle</h1>
      </div>

      <form onSubmit={handlePreSubmit} className="space-y-6 flex-grow">
        <div className="sketched-box bg-white/80 backdrop-blur-sm">
          <label className="block font-bold mb-2">THE WORD (5 LETTERS)</label>
          <input
            type="text"
            maxLength={5}
            className="sketched-input text-center text-4xl tracking-[0.5em] uppercase"
            value={word}
            onChange={(e) => setWord(e.target.value.replace(/[^A-Za-z]/g, ""))}
            placeholder="LOVER"
            required
          />
        </div>

        <div className="sketched-box bg-white/80 backdrop-blur-sm">
          <label className="block font-bold mb-2">HINT (OPTIONAL)</label>
          <input
            type="text"
            className="sketched-input"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Something related to..."
            maxLength={50}
          />
        </div>

        <div className="sketched-box bg-white/80 backdrop-blur-sm flex-grow">
          <label className="block font-bold mb-2">SECRET MESSAGE</label>
          <textarea
            className="w-full h-40 border-2 border-dashed border-ink p-4 font-hand text-xl bg-transparent outline-none resize-none"
            placeholder="Write something sweet (or spicy) to unlock..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || word.length !== 5}
          className="sketched-btn w-full flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {loading ? "Locking in..." : "Lock In Puzzle"}
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="sketched-box bg-white w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4">Are you sure?</h3>
            <p className="mb-6 opacity-70">
              You won't be able to edit this puzzle once you lock it in!
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 font-bold border-2 border-ink rounded-lg hover:bg-gray-100"
              >
                Go Back
              </button>
              <button
                onClick={handleLockIn}
                className="flex-1 py-3 font-bold bg-accent-pink border-2 border-ink rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Yes, Lock In!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Word Modal */}
      {showDuplicateError && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="sketched-box bg-white w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-bold mb-2 text-red-500">
              Oops! Used Word 🙈
            </h3>
            <p className="mb-6 opacity-70">
              You've already used{" "}
              <span className="font-bold">"{word.toUpperCase()}"</span> in a
              past puzzle.
              <br />
              <br />
              Please choose a new word to keep it fun!
            </p>

            <button
              onClick={() => setShowDuplicateError(false)}
              className="w-full py-3 font-bold border-2 border-ink rounded-lg hover:bg-gray-100"
            >
              Okay, I'll change it
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
