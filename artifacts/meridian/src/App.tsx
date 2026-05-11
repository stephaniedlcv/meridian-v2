import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import WelcomePage from "@/pages/WelcomePage";
import DashboardPage from "@/pages/DashboardPage";
import ProfilePageUser from "@/pages/ProfilePage";
import ProfileSetupPage from "@/pages/onboarding/ProfilePage";
import GoalsPage from "@/pages/onboarding/GoalsPage";
import ConnectPage from "@/pages/onboarding/ConnectPage";
import LabsUploadPage from "@/pages/labs/UploadPage";
import LabsHistoryPage from "@/pages/labs/HistoryPage";
import NotFound from "@/pages/not-found";

function RootRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/onboarding/welcome", { replace: true });
      }
    });
  }, [navigate]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/onboarding/welcome" component={WelcomePage} />
      <Route path="/onboarding/profile" component={ProfileSetupPage} />
      <Route path="/onboarding/goals" component={GoalsPage} />
      <Route path="/onboarding/connect" component={ConnectPage} />
      <Route path="/labs/upload" component={LabsUploadPage} />
      <Route path="/labs/history" component={LabsHistoryPage} />
      <Route path="/profile" component={ProfilePageUser} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
