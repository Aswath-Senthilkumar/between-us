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
  const [prevTab, setPrevTab] = useState<"received" | "sent">("received");

  // Puzzles state
  const [receivedPuzzles, setReceivedPuzzles] = useState<Puzzle[]>([]);
  const [sentPuzzles, setSentPuzzles] = useState<Puzzle[]>([]);

  // Separate loading states
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [hasFetchedReceived, setHasFetchedReceived] = useState(false);
  const [hasFetchedSent, setHasFetchedSent] = useState(false);

  // Separate pagination
  const [receivedPage, setReceivedPage] = useState(0);
  const [sentPage, setSentPage] = useState(0);

  // Swipe Handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const ITEMS_PER_PAGE = 10;

  const formattedDate = getLocalDate();

  // Optimized Fetch
  const fetchPuzzles = useCallback(
    async (
      targetTab: "received" | "sent" | "both" = "both",
      showLoading = true
    ) => {
      if (!profile?.partner_id) return;

      const fetchType = async (type: "received" | "sent") => {
        const currentPage = type === "received" ? receivedPage : sentPage;
        let query = supabase
          .from("puzzles")
          .select("*")
          .order("date", { ascending: false })
          .range(
            currentPage * ITEMS_PER_PAGE,
            (currentPage + 1) * ITEMS_PER_PAGE - 1
          );

        if (type === "received") {
          query = query.eq("solver_id", profile.id);
        } else {
          query = query.eq("setter_id", profile.id);
        }
        return query;
      };

      const promises = [];
      if (targetTab === "received" || targetTab === "both") {
        if (showLoading) setLoadingReceived(true);
        promises.push(
          fetchType("received").then(({ data, error }) => {
            if (!error && data) setReceivedPuzzles(data);
            setHasFetchedReceived(true);
            if (showLoading) setLoadingReceived(false);
          })
        );
      }
      if (targetTab === "sent" || targetTab === "both") {
        if (showLoading) setLoadingSent(true);
        promises.push(
          fetchType("sent").then(({ data, error }) => {
            if (!error && data) setSentPuzzles(data);
            setHasFetchedSent(true);
            if (showLoading) setLoadingSent(false);
          })
        );
      }

      await Promise.all(promises);
    },
    [profile?.partner_id, profile?.id, receivedPage, sentPage]
  );

  // Initial Load & Realtime
  useEffect(() => {
    // Initial fetch of first pages
    // Only if never fetched? Or always refresh on mount?
    // Usually safe to refresh "both" on mount to get latest updates.
    // Optimization: If we already have data in state (from nav back), maybe skip?
    // But for now, ensuring robustness on mount is better.
    // The "loading again" complaint is mainly about SWITCHING tabs.
    // So distinct hasFetched check in TAB handler is key.
    fetchPuzzles("both", true);

    const channel = supabase
      .channel("puzzles-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "puzzles" },
        () => fetchPuzzles("both", false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.partner_id, profile?.id]); // Only run on mount/profile change

  // Pagination Effects - Trigger only on page change
  useEffect(() => {
    // Rely on strict dependency on page
    if (receivedPage > 0) {
      fetchPuzzles("received", true);
    }
  }, [receivedPage]);

  // We skip strict "sentPage" effect to avoid double fetch on mount since mount calls "both"?
  // Actually, cleanest way is: mount calls "both".
  // pagination calls specific.
  // But if page is 0, we already fetched it?
  // Let's add a guard: if (sentPage === 0 && sentPuzzles.length === 0) -> let initial handle it?
  // Simplify: Pagination buttons can trigger fetch directly!
  // BUT user requested "caching".
  // The effect pattern is fine if we guard against redundant initial calls.
  // However, simple implementation:

  useEffect(() => {
    if (sentPage > 0) {
      fetchPuzzles("sent", true);
    }
  }, [sentPage]);

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

  const handleUnlockMessage = async (puzzleId: string) => {
    // Optimistic update
    const updatePuzzleInList = (list: Puzzle[]) =>
      list.map((p) =>
        p.id === puzzleId ? { ...p, message_revealed: true } : p
      );

    setSentPuzzles((prev) => updatePuzzleInList(prev));
    setReceivedPuzzles((prev) => updatePuzzleInList(prev));

    await supabase
      .from("puzzles")
      .update({ message_revealed: true })
      .eq("id", puzzleId);
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

  const activePuzzles =
    activeTab === "received" ? receivedPuzzles : sentPuzzles;
  const currentPage = activeTab === "received" ? receivedPage : sentPage;
  const todayPuzzle = activePuzzles.find((p) => p.date === formattedDate);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Swipe Handlers
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeTab === "received") {
      setPrevTab("received");
      setActiveTab("sent");
      if (!hasFetchedSent) fetchPuzzles("sent", true);
    }
    if (isRightSwipe && activeTab === "sent") {
      setPrevTab("sent");
      setActiveTab("received");

      // Strict caching check
      if (!hasFetchedReceived) fetchPuzzles("received", true);
    }
  };

  // Animation class based on direction
  // if active is sent and prev was received -> slide in from right
  // if active is received and prev was sent -> slide in from left
  // default (initial) -> just fade
  const getAnimationClass = () => {
    if (activeTab === "sent" && prevTab === "received")
      return "animate-in slide-in-from-right duration-300 fade-in";
    if (activeTab === "received" && prevTab === "sent")
      return "animate-in slide-in-from-left duration-300 fade-in";
    return "animate-in fade-in zoom-in duration-300"; // fallback/initial
  };

  // VIEW 2: Partner Linked (Tabs Dashboard)
  return (
    <PageLayout
      theme="blue"
      className="flex flex-col max-w-md mx-auto p-4 overflow-x-hidden"
    >
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
            setPrevTab("sent");
            setActiveTab("received");
            if (!hasFetchedReceived) fetchPuzzles("received", true);
          }}
          className={`flex-1 pb-2 text-lg font-bold transition-all duration-300 ${
            activeTab === "received"
              ? "border-b-4 border-accent-pink text-ink"
              : "opacity-40 hover:opacity-70"
          }`}
        >
          Received 💌
        </button>
        <button
          onClick={() => {
            if (activeTab === "sent") return;
            setPrevTab("received");
            setActiveTab("sent");
            if (!hasFetchedSent) fetchPuzzles("sent", true);
          }}
          className={`flex-1 pb-2 text-lg font-bold transition-all duration-300 ${
            activeTab === "sent"
              ? "border-b-4 border-accent-blue text-ink"
              : "opacity-40 hover:opacity-70"
          }`}
        >
          Sent ✏️
        </button>
      </div>

      {/* Swipeable Content Area */}
      <div
        className="flex-grow flex flex-col min-h-0 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEndHandler}
      >
        {/* Main Action Area (Top of list) */}
        <div
          className={`mb-8 ${getAnimationClass()}`}
          key={`action-${activeTab}`}
        >
          {(activeTab === "received" ? loadingReceived : loadingSent) &&
          activePuzzles.length === 0 ? (
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
                <h3 className="text-lg font-bold mb-2">
                  Today's Puzzle Solved!
                </h3>
                <p>Message: "{todayPuzzle.secret_message}"</p>
                <p className="text-xs opacity-50 mt-2">(Tap to view board)</p>
              </div>
            ) : todayPuzzle.guesses && todayPuzzle.guesses.length >= 6 ? (
              todayPuzzle.message_viewed && todayPuzzle.message_revealed ? (
                // Message Viewed: Show content like solved card
                <div
                  onClick={() => navigate("/solve")}
                  className="sketched-box bg-accent-green/30 w-full text-center p-6 border-dashed cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <div className="flex items-center justify-center gap-2 mb-2 text-green-700 font-bold">
                    <Unlock size={20} />
                    <h3 className="text-lg m-0">Message Unlocked!</h3>
                  </div>
                  <p>"{todayPuzzle.secret_message}"</p>
                  <p className="text-xs opacity-50 mt-2">(Tap to view board)</p>
                </div>
              ) : (
                // Not Viewed yet or just failed: Show Status Card
                <div
                  onClick={() => navigate("/solve")}
                  className="sketched-box bg-gray-100 w-full text-center p-6 border-dashed cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  {todayPuzzle.message_revealed ? (
                    <>
                      <h3 className="text-lg font-bold mb-2 text-green-600">
                        Message Unlocked! 🔓
                      </h3>
                      <div className="font-bold mb-1 opacity-80">
                        Tap to view message
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold mb-2 text-red-500">
                        Puzzle Failed
                      </h3>
                      {todayPuzzle.message_requested ? (
                        <div className="text-accent-blue font-bold mb-1 animate-pulse">
                          Request Sent ⏳
                        </div>
                      ) : (
                        <div className="opacity-70 mb-1">Message Locked 🔒</div>
                      )}
                    </>
                  )}
                  <p className="text-xs opacity-50 mt-2">(Tap to view)</p>
                </div>
              )
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
              <p className="opacity-70 text-sm mb-2">
                {todayPuzzle.is_solved
                  ? "Partner solved it! 🎉"
                  : todayPuzzle.guesses && todayPuzzle.guesses.length >= 6
                  ? "Partner failed to solve."
                  : "Waiting for partner to solve..."}
              </p>

              {/* Unlock Option for Failed Puzzles */}
              {!todayPuzzle.is_solved &&
                todayPuzzle.guesses &&
                todayPuzzle.guesses.length >= 6 &&
                (todayPuzzle.message_requested ||
                  todayPuzzle.message_revealed) && (
                  <div className="mt-4 pt-4 border-t border-ink/10">
                    {todayPuzzle.message_revealed ? (
                      <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                        <Unlock size={16} /> Message Unlocked
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUnlockMessage(todayPuzzle.id)}
                        className="flex items-center justify-center gap-2 mx-auto sketched-btn bg-red-100 border-red-300 hover:bg-red-200 text-red-800 text-sm py-2 px-4"
                      >
                        <span className="animate-pulse">
                          ⚠️ Request: Unlock Message
                        </span>
                        <Lock size={16} />
                      </button>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* History List */}
        <div
          className="space-y-4 flex-grow animate-in fade-in duration-500"
          key={`history-${activeTab}`}
        >
          <h3 className="font-bold opacity-50 text-sm tracking-widest uppercase">
            {activeTab === "received" ? "History" : "Past Notes"}
          </h3>

          {(activeTab === "received" ? loadingReceived : loadingSent) &&
          activePuzzles.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              Loading history...
            </div>
          ) : activePuzzles.length === 0 ? (
            <div className="text-center py-10 opacity-40">
              No records found.
            </div>
          ) : (
            activePuzzles.map((puzzle) => (
              <div
                key={puzzle.id}
                onClick={() => {
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
                      : puzzle.guesses && puzzle.guesses.length >= 6
                      ? puzzle.message_revealed
                        ? "Message Unlocked"
                        : puzzle.message_requested
                        ? "Failed • Request Sent"
                        : "Failed"
                      : "Unsolved"}
                  </div>
                </div>
                <div>
                  {puzzle.is_solved || puzzle.message_revealed ? (
                    <Unlock className="text-green-600 wobbly-icon" size={20} />
                  ) : puzzle.guesses && puzzle.guesses.length >= 6 ? (
                    <Lock className="text-red-500 wobbly-icon" size={20} />
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
            onClick={() => {
              if (activeTab === "received")
                setReceivedPage((p) => Math.max(0, p - 1));
              else setSentPage((p) => Math.max(0, p - 1));
            }}
            disabled={currentPage === 0}
            className="p-2 disabled:opacity-30 hover:bg-black/5 rounded-full"
          >
            <ChevronLeft />
          </button>
          <span className="font-mono text-sm opacity-50">
            Page {currentPage + 1}
          </span>
          <button
            onClick={() => {
              if (activeTab === "received") setReceivedPage((p) => p + 1);
              else setSentPage((p) => p + 1);
            }}
            disabled={activePuzzles.length < ITEMS_PER_PAGE}
            className="p-2 disabled:opacity-30 hover:bg-black/5 rounded-full"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
