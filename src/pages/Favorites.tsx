import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/useAuth";
import PageLayout from "../components/PageLayout";
import PuzzleCard from "../components/PuzzleCard";
import type { Puzzle } from "../types/index";

export default function Favorites() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<{
    received: Puzzle[];
    sent: Puzzle[];
  }>({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");

  useEffect(() => {
    if (!profile) return;

    const fetchFavorites = async () => {
      setLoading(true);
      // Fetch favorite IDs first
      const { data: favIds, error: favError } = await supabase
        .from("favorites")
        .select("puzzle_id")
        .eq("user_id", profile.id);

      if (favError || !favIds) {
        setLoading(false);
        return;
      }

      const ids = favIds.map((f) => f.puzzle_id);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch actual puzzles
      const { data: puzzles, error: puzzleError } = await supabase
        .from("puzzles")
        .select("*")
        .in("id", ids)
        .order("date", { ascending: false });

      if (puzzleError || !puzzles) {
        setLoading(false);
        return;
      }

      // Split into received/sent
      const received = puzzles.filter((p) => p.solver_id === profile.id);
      const sent = puzzles.filter((p) => p.setter_id === profile.id);

      setFavorites({ received, sent });
      setLoading(false);
    };

    fetchFavorites();
  }, [profile]);

  const handleUnfavorite = async (puzzleId: string) => {
    // Optimistic remove
    setFavorites((prev) => ({
      received: prev.received.filter((p) => p.id !== puzzleId),
      sent: prev.sent.filter((p) => p.id !== puzzleId),
    }));

    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", profile?.id)
      .eq("puzzle_id", puzzleId);
  };

  return (
    <PageLayout className="p-4 max-w-md mx-auto" theme="white">
      <div className="flex items-center gap-4 mb-6">
        <ArrowLeft
          className="cursor-pointer w-6 h-6"
          onClick={() => navigate("/")}
        />
        <h1 className="text-2xl font-display flex items-center gap-2">
          <Heart className="fill-accent-pink text-accent-pink" /> Favorites
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-ink mb-6">
        <button
          onClick={() => setActiveTab("received")}
          className={`flex-1 pb-2 text-lg font-bold transition-all ${
            activeTab === "received"
              ? "border-b-4 border-accent-pink text-ink"
              : "opacity-40 hover:opacity-70"
          }`}
        >
          Received ({favorites.received.length})
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          className={`flex-1 pb-2 text-lg font-bold transition-all ${
            activeTab === "sent"
              ? "border-b-4 border-accent-blue text-ink"
              : "opacity-40 hover:opacity-70"
          }`}
        >
          Sent ({favorites.sent.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center opacity-50 py-10">Loading favorites...</div>
      ) : activeTab === "received" ? (
        <div className="space-y-4">
          {favorites.received.length === 0 ? (
            <div className="text-center opacity-50 py-10">
              No favorite received puzzles yet.
            </div>
          ) : (
            favorites.received.map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                type="received"
                isFavorite={true}
                onToggleFavorite={(e) => {
                  e.stopPropagation();
                  handleUnfavorite(puzzle.id);
                }}
                onClick={() =>
                  navigate(`/solve?date=${puzzle.date}&type=received`)
                }
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {favorites.sent.length === 0 ? (
            <div className="text-center opacity-50 py-10">
              No favorite sent puzzles yet.
            </div>
          ) : (
            favorites.sent.map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                type="sent"
                isFavorite={true} // Always favorited in this list
                onToggleFavorite={(e) => {
                  e.stopPropagation();
                  handleUnfavorite(puzzle.id);
                }}
                onClick={() => navigate(`/solve?date=${puzzle.date}&type=sent`)}
              />
            ))
          )}
        </div>
      )}
    </PageLayout>
  );
}
