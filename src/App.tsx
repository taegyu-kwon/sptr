import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "./lib/store";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import { Splash, Toasts } from "./components/Toast";

import InputPage from "./pages/player/Input";
import StatsPage from "./pages/player/Stats";
import GrowthPage from "./pages/player/Growth";
import RankingPage from "./pages/player/Ranking";
import FeedbackPage from "./pages/player/Feedback";
import PlanPage from "./pages/player/Plan";

import OverviewPage from "./pages/coach/Overview";
import PlayersPage from "./pages/coach/Players";
import PlayerDetailPage from "./pages/coach/PlayerDetail";
import CoachRankingPage from "./pages/coach/Ranking";
import LineupPage from "./pages/coach/Lineup";
import CoachFeedbackPage from "./pages/coach/Feedback";
import GamesPage from "./pages/coach/Games";
import CoachSbiListPage from "./pages/coach/SbiList";
import CoachSbiDetailPage from "./pages/coach/SbiDetail";
import SbiPage from "./pages/Sbi";
import TrainingNoticePage from "./pages/TrainingNotice";
import MonthlySchedulePage from "./pages/MonthlySchedule";
import AttendancePage from "./pages/coach/Attendance";
import PlayerAttendancePage from "./pages/player/Attendance";
import CentersPage from "./pages/Centers";
import TeamPage from "./pages/coach/Team";
import AccountPage from "./pages/Account";

export default function App() {
  return (
    <>
      <Screens />
      <Toasts />
    </>
  );
}

function Screens() {
  const { user, status } = useStore();

  // 서버 모드: 저장된 로그인 확인 · 팀 데이터 읽는 중
  if (status === "booting") return <Splash text="로그인 상태를 확인하는 중입니다" />;
  if (status === "loading") return <Splash text="팀 데이터를 불러오는 중입니다" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  const home = user.role === "player" ? "/p/stats" : "/c/overview";

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
            <Route path="/p/notice" element={<TrainingNoticePage />} />
            <Route path="/p/calendar" element={<MonthlySchedulePage />} />
            <Route path="/p/attendance" element={<PlayerAttendancePage />} />
            <Route path="/sbi" element={<SbiPage />} />
            <Route path="/p/centers" element={<CentersPage />} />
          </>
        )}
        {user.role === "coach" && (
          <>
            <Route path="/c/overview" element={<OverviewPage />} />
            <Route path="/c/players" element={<PlayersPage />} />
            <Route path="/c/players/:id" element={<PlayerDetailPage />} />
            <Route path="/c/sbi" element={<CoachSbiListPage />} />
            <Route path="/c/sbi/:id" element={<CoachSbiDetailPage />} />
            <Route path="/c/ranking" element={<CoachRankingPage />} />
            <Route path="/c/lineup" element={<LineupPage />} />
            <Route path="/c/feedback" element={<CoachFeedbackPage />} />
            <Route path="/c/notice" element={<TrainingNoticePage />} />
            <Route path="/c/calendar" element={<MonthlySchedulePage />} />
            <Route path="/c/training" element={<Navigate to="/c/notice" replace />} />
            <Route path="/c/games" element={<GamesPage />} />
            <Route path="/c/attendance" element={<AttendancePage />} />
            <Route path="/c/centers" element={<CentersPage />} />
            <Route path="/c/team" element={<TeamPage />} />
          </>
        )}
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}
