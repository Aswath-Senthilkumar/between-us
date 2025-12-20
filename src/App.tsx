import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

// Pages (function placeholders for now)
import Login from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SetPuzzle from "./pages/SetPuzzle";
import Game from "./pages/Game";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin text-ink">
          <Loader2 size={48} className="wobbly-icon" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/set"
        element={
          <ProtectedRoute>
            <SetPuzzle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/solve"
        element={
          <ProtectedRoute>
            <Game />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      {/* Global SVG Filters for Sketched Effect */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="wobbly-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="3"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
        </filter>
      </svg>

      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
