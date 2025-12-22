import { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.partner_id) return;
    if (word.length !== 5) return alert("Word must be 5 letters");

    setLoading(true);
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
    <PageLayout theme="pink" className="p-4 max-w-md mx-auto flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-black/5 rounded-full"
        >
          <ArrowLeft />
        </button>
        <h1>Set Daily Puzzle</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 flex-grow">
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
    </PageLayout>
  );
}
