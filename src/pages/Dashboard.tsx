import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/useAuth";
import { supabase } from "../lib/supabase";
import {
  Settings,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Mail,
  Check,
  X,
  Clock,
  Heart,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Puzzle, PartnerRequest } from "../types";
import OnboardingTour from "../components/OnboardingTour";
import PuzzleCard from "../components/PuzzleCard";
import type { Step } from "react-joyride";
import { getLocalDate } from "../utils/date";
import PageLayout from "../components/PageLayout";
import { withTimeout } from "../utils/async";

const DASHBOARD_STEPS: Step[] = [
  {
    target: "body",
    content: (
      <div className="text-center">
        <h3>Welcome to Between Us! 💖</h3>
        <p>
          Let's take a quick tour of your new favorite space for connection.
        </p>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: ".tour-tabs",
    content:
      "Here you can switch between messages you've RECEIVED 💌 and words you've SENT ✏️.",
    placement: "bottom",
  },
  {
    target: ".tour-action-area",
    content:
      "This is your Action Area! If you've received a puzzle, it will show up here for you to solve.",
    placement: "bottom",
  },
  {
    target: ".tour-action-area",
    content:
      "Switch to the 'Sent' tab to create daily puzzles for your partner! Set a word and a secret message.",
    placement: "bottom",
  },
  {
    target: ".tour-history",
    content:
      "Look back at all your past notes and puzzles here. Click on any received puzzle to replay it!",
    placement: "top",
  },
  {
    target: ".tour-favorites",
    content: "Save your favorite messages and puzzles here! ❤️",
    placement: "left",
  },
  {
    target: ".tour-settings",
    content:
      "Settings are tucked away here if you need to manage your account.",
    placement: "left",
  },
  {
    target: "body",
    content: (
      <div className="text-center">
        <h3>Let's Play! 🚀</h3>
        <p>You're all set to start your daily ritual.</p>
      </div>
    ),
  },
];

const FAVORITES_STEPS: Step[] = [
  {
    target: ".tour-favorites",
    content: (
      <div className="text-center">
        <h3>New Feature! ❤️</h3>
        <p>Save your favorite messages and puzzles here.</p>
      </div>
    ),
    placement: "left",
    disableBeacon: true,
  },
];

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Onboarding Logic
  const [runTour, setRunTour] = useState(false);
  const [tourSteps, setTourSteps] = useState<Step[]>([]);
  const [tourMode, setTourMode] = useState<"onboarding" | "favorites" | null>(
    null
  );

  useEffect(() => {
    if (!profile) return;

    // 1. New User: Full Tour
    if (!profile.has_seen_onboarding) {
      setTourSteps(DASHBOARD_STEPS);
      setTourMode("onboarding");
      setRunTour(true);
      return;
    }

    // 2. Existing User: Check Features
    const seen = profile.seen_features || [];
    if (!seen.includes("favorites")) {
      setTourSteps(FAVORITES_STEPS);
      setTourMode("favorites");
      setRunTour(true);
    }
  }, [profile]);

  const handleTourFinish = async () => {
    setRunTour(false);
    if (!profile || !tourMode) return;

    if (tourMode === "onboarding") {
      // Mark onboarding done AND favorites seen
      await supabase
        .from("profiles")
        .update({
          has_seen_onboarding: true,
          seen_features: ["favorites"],
        })
        .eq("id", profile.id);
    } else if (tourMode === "favorites") {
      // Mark favorites seen
      const currentSeen = profile.seen_features || [];
      const newSeen = [...currentSeen, "favorites"];

      await supabase
        .from("profiles")
        .update({
          seen_features: newSeen,
        })
        .eq("id", profile.id);
    }
    refreshProfile();
  };

  // Tabs state
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [prevTab, setPrevTab] = useState<"received" | "sent">("received");

  // Puzzles state
  const [receivedPuzzles, setReceivedPuzzles] = useState<Puzzle[]>([]);
  const [sentPuzzles, setSentPuzzles] = useState<Puzzle[]>([]);

  // Invitation State
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

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

  // Favorites State
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("favorites")
      .select("puzzle_id")
      .eq("user_id", profile.id);
    if (data) {
      setFavoriteIds(new Set(data.map((f) => f.puzzle_id)));
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleToggleFavorite = async (
    e: React.MouseEvent,
    puzzleId: string
  ) => {
    e.stopPropagation();
    const isFav = favoriteIds.has(puzzleId);

    // Optimistic Update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(puzzleId);
      else next.add(puzzleId);
      return next;
    });

    if (isFav) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", profile!.id)
        .eq("puzzle_id", puzzleId);
    } else {
      await supabase
        .from("favorites")
        .insert({ user_id: profile!.id, puzzle_id: puzzleId });
    }
  };

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
  }, [profile?.partner_id, profile?.id, fetchPuzzles]); // Only run on mount/profile change

  // Pagination Effects - Trigger only on page change
  useEffect(() => {
    // Rely on strict dependency on page
    if (receivedPage > 0) {
      fetchPuzzles("received", true);
    }
  }, [receivedPage, fetchPuzzles]);

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
  }, [sentPage, fetchPuzzles]);

  // Fetch Requests (only if no partner)
  useEffect(() => {
    if (profile && !profile.partner_id) {
      const fetchRequests = async () => {
        setLoadingRequests(true);
        const { data } = await supabase
          .from("partner_requests")
          .select("*")
          .or(`sender_id.eq.${profile.id},receiver_email.eq.${profile.email}`)
          .order("created_at", { ascending: false });

        if (data) setPartnerRequests(data as PartnerRequest[]);
        setLoadingRequests(false);
      };

      fetchRequests();

      // Realtime for requests
      const channel = supabase
        .channel("requests_and_profile")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "partner_requests" },
          () => {
            fetchRequests();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${profile.id}`,
          },
          () => {
            refreshProfile();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, refreshProfile]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setSendingInvite(true);
    setInviteMsg(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await withTimeout<any>(
        supabase.rpc("send_invite", {
          target_email: inviteEmail,
        }),
        15000,
        "Network request timed out. Please try again."
      );

      if (error) throw error;
      setInviteMsg("Invite sent! 💌");
      setInviteEmail("");
      // Refresh requests
      const { data } = await supabase
        .from("partner_requests")
        .select("*")
        .or(`sender_id.eq.${profile!.id},receiver_email.eq.${profile!.email}`)
        .order("created_at", { ascending: false });
      if (data) setPartnerRequests(data as PartnerRequest[]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Not found or Already Pending";
      setInviteMsg(`Error: ${errorMessage}`);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAcceptInvite = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc("accept_invite", {
        request_id: requestId,
      });
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      alert(
        "Failed to accept: " + (err instanceof Error ? err.message : "Unknown")
      );
    }
  };

  const handleRejectInvite = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc("reject_invite", {
        request_id: requestId,
      });
      if (error) throw error;
      // Refresh list
      const { data } = await supabase
        .from("partner_requests")
        .select("*")
        .or(`sender_id.eq.${profile!.id},receiver_email.eq.${profile!.email}`)
        .order("created_at", { ascending: false });
      if (data) setPartnerRequests(data as PartnerRequest[]);
    } catch (err) {
      alert(
        "Failed to reject: " + (err instanceof Error ? err.message : "Unknown")
      );
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

  if (!profile) {
    return (
      <PageLayout
        theme="white"
        className="flex items-center justify-center h-screen"
      >
        <div className="animate-pulse opacity-50 flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-4 border-accent-pink border-t-transparent animate-spin" />
          <span className="text-sm font-mono">Loading profile...</span>
          <button
            onClick={() => window.location.reload()}
            className="text-xs underline mt-2 hover:text-accent-pink cursor-pointer pointer-events-auto"
          >
            Taking too long? Tap to reload
          </button>
        </div>
      </PageLayout>
    );
  }

  // VIEW 1: No Partner Linked (Invitation System)
  if (!profile.partner_id) {
    return (
      <PageLayout
        theme="white"
        className="flex flex-col items-center justify-center p-4"
      >
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

        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <Heart className="wobbly-icon h-16 w-16 mx-auto text-accent-pink mb-4" />
            <h2 className="text-3xl font-display mb-2">Find your person</h2>
            <p className="opacity-70">
              Invite your partner to start your ritual.
            </p>
          </div>

          {/* Send Invite Form - Only show if NO pending outgoing requests */}
          {partnerRequests.some(
            (r) => r.sender_id === profile.id && r.status === "pending"
          ) ? (
            <div className="sketched-box bg-white p-6 relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Clock size={80} />
              </div>
              <h3 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
                <Clock size={24} className="text-accent-blue" /> Waiting for
                Partner
              </h3>
              <p className="opacity-70">
                Invitation sent to{" "}
                <span className="font-bold">
                  {
                    partnerRequests.find((r) => r.sender_id === profile.id)
                      ?.receiver_email
                  }
                </span>
                .
              </p>
              <p className="text-sm opacity-50 mt-2">
                Ask them to check their dashboard to accept!
              </p>
            </div>
          ) : (
            <div className="sketched-box bg-white p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Mail size={80} />
              </div>

              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Send size={20} /> Send Invite
              </h3>

              <form
                onSubmit={handleSendInvite}
                className="space-y-4 relative z-10"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-1">
                    Partner's Email
                  </label>
                  <input
                    type="email"
                    placeholder="partner@example.com"
                    className="sketched-input w-full bg-transparent"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                {inviteMsg && (
                  <p
                    className={`text-sm font-bold ${
                      inviteMsg.includes("Error")
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {inviteMsg}
                  </p>
                )}

                <button
                  disabled={sendingInvite}
                  className="sketched-btn w-full bg-accent-yellow"
                >
                  {sendingInvite ? "Sending..." : "Send Invitation"}
                </button>
              </form>
            </div>
          )}

          {/* Pending Requests List */}
          {loadingRequests ? (
            <div className="text-center opacity-50 py-4 animate-pulse">
              Checking for invites...
            </div>
          ) : (
            partnerRequests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 opacity-50 px-2">
                  <Clock size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Pending Requests
                  </span>
                </div>

                {partnerRequests.map((req) => {
                  const isIncoming = req.receiver_email === profile.email;
                  return (
                    <div
                      key={req.id}
                      className={`sketched-box p-4 flex items-center justify-between ${
                        isIncoming
                          ? "bg-accent-blue/10 border-accent-blue"
                          : "opacity-70 bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-lg mb-1">
                          {isIncoming ? "Incoming Invite 💌" : "Invite Sent 📨"}
                        </div>
                        <div className="text-sm opacity-70 font-mono">
                          {isIncoming ? "From: " : "To: "}
                          {isIncoming ? "Partner" : req.receiver_email}
                        </div>
                        <div className="text-xs opacity-50 mt-1 capitalize">
                          {req.status}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isIncoming && req.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleAcceptInvite(req.id)}
                              className="w-10 h-10 rounded-full bg-accent-green flex items-center justify-center border-2 border-ink hover:scale-110 transition-transform shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                            >
                              <Check className="text-white" size={20} />
                            </button>
                            <button
                              onClick={() => handleRejectInvite(req.id)}
                              className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center border-2 border-ink hover:scale-110 transition-transform shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                            >
                              <X className="text-white" size={20} />
                            </button>
                          </>
                        )}
                        {!isIncoming && req.status === "pending" && (
                          <div className="px-3 py-1 bg-gray-200 rounded-full text-xs font-bold opacity-50">
                            Waiting
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </PageLayout>
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
      <OnboardingTour
        run={runTour}
        steps={tourSteps}
        onFinish={handleTourFinish}
        onStepChange={(data) => {
          if (tourMode !== "onboarding") return;
          const { index, type } = data;

          // Sync tabs with steps using step:before (fires on entering the step)
          if (type === "step:before") {
            if (index === 2) {
              setActiveTab("received");
              if (!hasFetchedReceived) fetchPuzzles("received", true);
            }
            if (index === 3) {
              setActiveTab("sent");
              if (!hasFetchedSent) fetchPuzzles("sent", true);
            }
            // Switch back to received for history/settings steps as default view
            if (index === 4) {
              setActiveTab("received");
            }
          }
        }}
      />
      <div className="absolute top-4 right-16 z-10 tour-favorites">
        <Heart
          className="wobbly-icon w-8 h-8 text-ink cursor-pointer hover:scale-110 transition-transform hover:text-accent-pink"
          onClick={() => navigate("/favorites")}
        />
      </div>
      <div className="absolute top-4 right-4 z-10 tour-settings">
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
      <div className="flex border-b-2 border-ink mb-6 tour-tabs">
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
        <div className="mb-8 tour-action-area">
          <div className={`${getAnimationClass()}`} key={`action-${activeTab}`}>
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
                  <p className="text-sm opacity-60 mt-2">
                    Remind your partner!
                  </p>
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
                    <p className="text-xs opacity-50 mt-2">
                      (Tap to view board)
                    </p>
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
                          <div className="opacity-70 mb-1">
                            Message Locked 🔒
                          </div>
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
        </div>

        {/* History List */}
        <div className="tour-history flex-grow flex flex-col">
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
                <PuzzleCard
                  key={puzzle.id}
                  puzzle={puzzle}
                  type={activeTab}
                  isFavorite={favoriteIds.has(puzzle.id)}
                  onToggleFavorite={(e) => handleToggleFavorite(e, puzzle.id)}
                  onClick={() => {
                    navigate(`/solve?date=${puzzle.date}&type=${activeTab}`);
                  }}
                />
              ))
            )}
          </div>
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
