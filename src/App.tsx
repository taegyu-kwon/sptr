import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "./lib/store";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";

import InputPage from "./pages/player/Input";
import StatsPage from "./pages/player/Stats";
import GrowthPage from "./pages/player/Growth";
import RankingPage from "./pages/player/Ranking";
import FeedbackPage from "./pages/player/Feedback";
import PlanPage from "./pages/player/Plan";

import PlayersPage from "./pages/coach/Players";
import PlayerDetailPage from "./pages/coach/PlayerDetail";
import CoachRankingPage from "./pages/coach/Ranking";
import LineupPage from "./pages/coach/Lineup";
import CoachFeedbackPage from "./pages/coach/Feedback";
import TrainingPage from "./pages/coach/Training";
import GamesPage from "./pages/coach/Games";
import CoachSbiListPage from "./pages/coach/SbiList";
import CoachSbiDetailPage from "./pages/coach/SbiDetail";
import SbiPage from "./pages/Sbi";

export default function App() {
  const { user } = useStore();

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  const home = user.role === "player" ? "/p/stats" : "/c/players";

  return (
    <Layout>
      <Routes>
        {user.role === "player" && (
          <>
            <Route path="/p/input" element={<InputPage />} />
            <Route path="/p/stats" element={<StatsPage />} />
            <Route path="/p/growth" element={<GrowthPage />} />
            <Route path="/p/ranking" element={<RankingPage />} />
            <Route path="/p/feedback" element={<FeedbackPage />} />
            <Route path="/p/plan" element={<PlanPage />} />
            <Route path="/sbi" element={<SbiPage />} />
          </>
        )}
        {user.role === "coach" && (
          <>
            <Route path="/c/players" element={<PlayersPage />} />
            <Route path="/c/players/:id" element={<PlayerDetailPage />} />
            <Route path="/c/sbi" element={<CoachSbiListPage />} />
            <Route path="/c/sbi/:id" element={<CoachSbiDetailPage />} />
            <Route path="/c/ranking" element={<CoachRankingPage />} />
            <Route path="/c/lineup" element={<LineupPage />} />
            <Route path="/c/feedback" element={<CoachFeedbackPage />} />
            <Route path="/c/training" element={<TrainingPage />} />
            <Route path="/c/games" element={<GamesPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}
