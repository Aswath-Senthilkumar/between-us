import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { useState } from "react";
import PageLayout from "../components/PageLayout";

export default function Settings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;

      // After deletion, sign out
      await signOut();
      navigate("/auth");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Error deleting account: ${message}`);
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <PageLayout theme="green" className="flex flex-col max-w-md mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-black/5 rounded-full"
        >
          <ArrowLeft />
        </button>
        <h1 className="text-xl font-bold">Account Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="sketched-box bg-white/80 backdrop-blur-sm">
          <h2 className="text-lg font-bold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm opacity-60 font-bold block mb-1">
                EMAIL
              </label>
              <div className="font-mono bg-gray-50 p-2 rounded border border-ink/20">
                {profile.email}
              </div>
            </div>
            <div>
              <label className="text-sm opacity-60 font-bold block mb-1">
                USERNAME
              </label>
              <div className="font-mono bg-gray-50 p-2 rounded border border-ink/20">
                {profile.username || "Not set"}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="sketched-box bg-white/80 backdrop-blur-sm">
          <h2 className="text-lg font-bold mb-4">Actions</h2>
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className="w-full sketched-btn bg-white hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Logout
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sketched-btn bg-red-50 text-red-600 border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />
                Delete Account
              </button>
            ) : (
              <div className="bg-red-50 p-4 rounded border-2 border-red-500 border-dashed space-y-3 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <AlertTriangle size={24} />
                  <span>Are you sure?</span>
                </div>
                <p className="text-sm text-red-700">
                  This action is permanent. Your partner will be notified that
                  you left.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 px-4 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="flex-1 py-2 px-4 rounded bg-red-600 text-white font-bold hover:bg-red-700 shadow-sm"
                  >
                    {loading ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
