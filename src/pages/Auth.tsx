import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import PageLayout from "../components/PageLayout";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });
        if (error) throw error;

        // If email confirmation is off, we get a session immediately
        if (data.session) {
          navigate("/");
        } else {
          alert("Check your email to confirm signup!");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      theme="white"
      className="flex flex-col items-center justify-center p-4"
    >
      <div className="sketched-box w-full max-w-md flex flex-col items-center gap-6 bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center">
          <Heart className="wobbly-icon mb-2 h-12 w-12 text-accent-pink fill-accent-pink" />
          <h1>Between Us</h1>
          <p className="text-gray-500">A daily ritual for two.</p>
        </div>

        <form onSubmit={handleAuth} className="w-full space-y-4">
          {!isLogin && (
            <div>
              <input
                type="text"
                placeholder="Username"
                className="sketched-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="Email"
              className="sketched-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              className="sketched-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="sketched-btn w-full text-center"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <p className="text-sm">
          {isLogin ? "New here? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-ink underline bg-transparent border-0 cursor-pointer font-hand text-lg"
          >
            {isLogin ? "Create Account" : "Login"}
          </button>
        </p>
      </div>
    </PageLayout>
  );
}
