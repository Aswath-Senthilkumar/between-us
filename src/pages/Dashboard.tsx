import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Users } from "lucide-react";
import type { Puzzle } from "../types";

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const [partnerEmail, setPartnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Game state
  const [todaysPuzzle, setTodaysPuzzle] = useState<Puzzle | null>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);

  // Fetch puzzle effect
  const formattedDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (profile?.partner_id) {
      setLoadingPuzzle(true);
      supabase
        .from("puzzles")
        .select("*")
        .or(`setter_id.eq.${profile.id},solver_id.eq.${profile.id}`)
        .eq("date", formattedDate)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setTodaysPuzzle(null);
          } else {
            setTodaysPuzzle(data);
          }
          setLoadingPuzzle(false);
        });
    } else {
      setLoadingPuzzle(false);
    }
  }, [profile?.partner_id, profile?.id, formattedDate]);

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      // Call the stored procedure 'link_partner'
      const { error } = await supabase.rpc("link_partner", {
        partner_email: partnerEmail,
      });

      if (error) throw error;

      await refreshProfile();
      setMsg("Partner linked successfully! 🎉");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setMsg(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  // VIEW 1: No Partner Linked
  if (!profile.partner_id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="sketched-box w-full max-w-md text-center space-y-6">
          <Users className="wobbly-icon h-16 w-16 mx-auto text-ink" />

          <div>
            <h2>Find your person</h2>
            <p className="opacity-70">You need a partner to play this game.</p>
          </div>

          <div className="bg-accent-yellow/30 p-4 rounded-lg border-2 border-ink border-dashed">
            <p className="text-sm font-bold mb-1">YOUR EMAIL</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-lg">{profile.email}</span>
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-ink opacity-30"></div>
            <span className="flex-shrink mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-ink opacity-30"></div>
          </div>

          <form onSubmit={handleLinkPartner} className="space-y-4">
            <div className="text-left">
              <label className="block mb-1 ml-1 text-sm font-bold">
                ENTER PARTNER'S EMAIL
              </label>
              <input
                type="email"
                placeholder="partner@example.com"
                className="sketched-input"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                required
              />
            </div>

            {msg && (
              <p
                className={`text-sm ${
                  msg.includes("Error") ? "text-red-500" : "text-green-600"
                }`}
              >
                {msg}
              </p>
            )}

            <button disabled={loading} className="sketched-btn w-full">
              {loading ? "Linking..." : "Link Partner"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // VIEW 2: Partner Linked (Game Dashboard)
  return (
    <div className="p-4 max-w-md mx-auto space-y-6 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="text-center mb-8">
        <h1 className="text-4xl mb-2">Hello, {profile.username || "Love"}</h1>
        <p className="opacity-60">{formattedDate}</p>
      </div>

      {loadingPuzzle ? (
        <div className="animate-pulse">Checking for love notes...</div>
      ) : todaysPuzzle ? (
        // Puzzle Exists
        todaysPuzzle.setter_id === profile.id ? (
          <div className="sketched-box bg-accent-blue/30 w-full text-center p-8">
            <h3 className="text-xl mb-4">You set the word!</h3>
            <div className="text-4xl font-bold tracking-widest mb-4">
              {todaysPuzzle.target_word}
            </div>
            <p className="opacity-70">
              {todaysPuzzle.is_solved
                ? "Partner solved it! 🎉"
                : "Waiting for partner to solve..."}
            </p>
          </div>
        ) : (
          <a
            href="/solve"
            className="sketched-btn w-full text-center py-6 text-xl bg-accent-pink animate-pulse"
          >
            {todaysPuzzle.is_solved
              ? "View Message 💌"
              : "Play Daily Puzzle 🎮"}
          </a>
        )
      ) : (
        // No Puzzle Yet
        <div className="w-full space-y-4">
          <div className="sketched-box bg-white p-6 text-center opacity-80">
            <p>No puzzle set for today yet.</p>
          </div>

          <a
            href="/set"
            className="sketched-btn w-full text-center py-4 flex items-center justify-center gap-2"
          >
            <span>✏️</span> Set the Word
          </a>
        </div>
      )}
    </div>
  );
}
