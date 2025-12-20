import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/useAuth";
import { supabase } from "../lib/supabase";
import {
  Users,
  Settings,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Puzzle } from "../types";
import { getLocalDate } from "../utils/date";
import PageLayout from "../components/PageLayout";

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [partnerEmail, setPartnerEmail] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");

  // Puzzles state
  const [receivedPuzzles, setReceivedPuzzles] = useState<Puzzle[]>([]);
  const [sentPuzzles, setSentPuzzles] = useState<Puzzle[]>([]);
  const [loadingPuzzles, setLoadingPuzzles] = useState(true);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const formattedDate = getLocalDate();

  // Fetch puzzles based on tab and page
  // Fetch puzzles based on tab and page
  // Fetch puzzles based on tab and page
  const fetchPuzzles = useCallback(
    async (
      targetTab: "received" | "sent" | "both" = "both",
      showLoading = true
    ) => {
      if (!profile?.partner_id) return;
      if (showLoading) setLoadingPuzzles(true);

      const fetchType = async (type: "received" | "sent") => {
        let query = supabase
          .from("puzzles")
          .select("*")
          .order("date", { ascending: false })
          .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

        if (type === "received") {
          query = query.eq("solver_id", profile.id);
        } else {
          query = query.eq("setter_id", profile.id);
        }
        return query;
      };

      const promises = [];
      if (targetTab === "received" || targetTab === "both") {
        promises.push(
          fetchType("received").then(({ data, error }) => {
            if (!error && data) setReceivedPuzzles(data);
          })
        );
      }
      if (targetTab === "sent" || targetTab === "both") {
        promises.push(
          fetchType("sent").then(({ data, error }) => {
            if (!error && data) setSentPuzzles(data);
          })
        );
      }

      await Promise.all(promises);

      if (showLoading) setLoadingPuzzles(false);
    },
    [profile?.partner_id, profile?.id, page]
  );

  useEffect(() => {
    fetchPuzzles("both", true);

    // Realtime subscription
    const channel = supabase
      .channel("puzzles-dashboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puzzles",
        },
        () => {
          // Refresh without full loading state
          fetchPuzzles("both", false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPuzzles]);

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLink(true);
    setLinkMsg(null);

    try {
      const { error } = await supabase.rpc("link_partner", {
        partner_email: partnerEmail,
      });

      if (error) throw error;

      await refreshProfile();
      setLinkMsg("Partner linked successfully! 🎉");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setLinkMsg(`Error: ${errorMessage}`);
    } finally {
      setLoadingLink(false);
    }
  };

  const handleDismissNotification = async () => {
    await supabase.rpc("dismiss_notification");
    refreshProfile();
  };

  if (!profile) return null;

  // VIEW 1: No Partner Linked
  if (!profile.partner_id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4 z-10">
          <Settings
            className="wobbly-icon w-8 h-8 text-ink cursor-pointer hover:rotate-12 transition-transform"
            onClick={() => navigate("/settings")}
          />
        </div>

        {profile.system_notification && (
          <div className="w-full max-w-md mb-6 sketched-box bg-red-50 border-red-200 text-red-700 animate-in slide-in-from-top-4">
            <div className="flex items-start gap-4">
              <XCircle className="shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">Notification</h3>
                <p>{profile.system_notification}</p>
              </div>
              <button
                onClick={handleDismissNotification}
                className="text-sm underline opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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

            {linkMsg && (
              <p
                className={`text-sm ${
                  linkMsg.includes("Error") ? "text-red-500" : "text-green-600"
                }`}
              >
                {linkMsg}
              </p>
            )}

            <button disabled={loadingLink} className="sketched-btn w-full">
              {loadingLink ? "Linking..." : "Link Partner"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helper to determine if today's action is done
  const activePuzzles =
    activeTab === "received" ? receivedPuzzles : sentPuzzles;
  const todayPuzzle = activePuzzles.find((p) => p.date === formattedDate);

  // VIEW 2: Partner Linked (Tabs Dashboard)
  return (
    <PageLayout theme="blue" className="flex flex-col max-w-md mx-auto p-4">
      <div className="absolute top-4 right-4 z-10">
        <Settings
          className="wobbly-icon w-8 h-8 text-ink cursor-pointer hover:rotate-12 transition-transform"
          onClick={() => navigate("/settings")}
        />
      </div>

      <div className="text-center mb-6 mt-4">
        <h1 className="text-3xl mb-1">Hello, {profile.username || "Love"}</h1>
        <p className="opacity-60 font-mono text-sm">{formattedDate}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-ink mb-6">
        <button
          onClick={() => {
            if (activeTab === "received") return;
            setActiveTab("received");
            setPage(0);
            if (receivedPuzzles.length === 0) fetchPuzzles("received", true);
          }}
          className={`flex-1 pb-2 text-lg font-bold transition-colors ${
            activeTab === "received"
              ? "border-b-4 border-accent-pink"
              : "opacity-40"
          }`}
        >
          Received 💌
        </button>
        <button
          onClick={() => {
            if (activeTab === "sent") return;
            setActiveTab("sent");
            setPage(0);
            if (sentPuzzles.length === 0) fetchPuzzles("sent", true);
          }}
          className={`flex-1 pb-2 text-lg font-bold transition-colors ${
            activeTab === "sent"
              ? "border-b-4 border-accent-blue"
              : "opacity-40"
          }`}
        >
          Sent ✏️
        </button>
      </div>

      {/* Main Action Area (Top of list) */}
      <div className="mb-8">
        {loadingPuzzles ? (
          <div className="sketched-box bg-gray-100 p-6 text-center opacity-50 animate-pulse">
            Loading...
          </div>
        ) : activeTab === "received" ? (
          // RECEIVED TAB ACTION
          !todayPuzzle ? (
            <div className="sketched-box bg-white p-6 text-center opacity-80">
              <p>No puzzle received for today yet.</p>
              <p className="text-sm opacity-60 mt-2">Remind your partner!</p>
            </div>
          ) : todayPuzzle.is_solved ? (
            <div
              onClick={() => navigate("/solve")}
              className="sketched-box bg-accent-green/30 w-full text-center p-6 border-dashed cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <h3 className="text-lg font-bold mb-2">Today's Puzzle Solved!</h3>
              <p>Message: "{todayPuzzle.secret_message}"</p>
              <p className="text-xs opacity-50 mt-2">(Tap to view board)</p>
            </div>
          ) : (
            <a
              href="/solve"
              className="sketched-btn w-full text-center py-6 text-xl bg-accent-pink animate-pulse block"
            >
              Play Daily Puzzle 🎮
            </a>
          )
        ) : // SENT TAB ACTION
        !todayPuzzle ? (
          <a
            href="/set"
            className="sketched-btn w-full text-center py-6 text-xl bg-accent-blue block"
          >
            ✏️ Set Today's Word
          </a>
        ) : (
          <div className="sketched-box bg-accent-blue/20 w-full text-center p-6">
            <h3 className="text-lg font-bold mb-1">You set the word!</h3>
            <div className="text-2xl font-bold tracking-widest mb-2 font-mono">
              {todayPuzzle.target_word}
            </div>
            <p className="opacity-70 text-sm">
              {todayPuzzle.is_solved
                ? "Partner solved it! 🎉"
                : "Waiting for partner to solve..."}
            </p>
          </div>
        )}
      </div>

      {/* History List */}
      <div className="space-y-4 flex-grow">
        <h3 className="font-bold opacity-50 text-sm tracking-widest uppercase">
          {activeTab === "received" ? "History" : "Past Notes"}
        </h3>

        {loadingPuzzles && activePuzzles.length === 0 ? (
          <div className="text-center py-10 opacity-50">Loading history...</div>
        ) : activePuzzles.length === 0 ? (
          <div className="text-center py-10 opacity-40">No records found.</div>
        ) : (
          activePuzzles.map((puzzle) => (
            <div
              key={puzzle.id}
              onClick={() => {
                // Navigate to solve if it's a received puzzle, regardless of solved status
                // Or if sentiment is to just view history.
                // If it is 'sent', maybe we want a different view?
                // For now, let's allow opening 'received' puzzles to view them.
                if (activeTab === "received") {
                  navigate(`/solve?date=${puzzle.date}`);
                }
              }}
              className={`sketched-box p-4 flex items-center justify-between transition-colors ${
                puzzle.date === formattedDate
                  ? "border-2 border-ink"
                  : "border border-gray-300 opacity-80"
              } ${
                activeTab === "received"
                  ? "cursor-pointer hover:bg-gray-50"
                  : ""
              }`}
            >
              <div>
                <div className="font-bold text-lg">{puzzle.date}</div>
                <div className="text-sm opacity-60">
                  {activeTab === "sent"
                    ? `Word: ${puzzle.target_word}`
                    : puzzle.is_solved
                    ? puzzle.secret_message
                    : "Unsolved"}
                </div>
              </div>
              <div>
                {puzzle.is_solved ? (
                  <Unlock className="text-green-600 wobbly-icon" size={20} />
                ) : (
                  <Lock className="text-gray-400" size={20} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-ink/10">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="p-2 disabled:opacity-30 hover:bg-black/5 rounded-full"
        >
          <ChevronLeft />
        </button>
        <span className="font-mono text-sm opacity-50">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={activePuzzles.length < ITEMS_PER_PAGE}
          className="p-2 disabled:opacity-30 hover:bg-black/5 rounded-full"
        >
          <ChevronRight />
        </button>
      </div>
    </PageLayout>
  );
}
