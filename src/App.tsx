import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import OverviewPage from './pages/OverviewPage';
import SonarPage from './pages/SonarPage';
import DetectionsPage from './pages/DetectionsPage';
import Map3DPage from './pages/Map3DPage';
import RecoveryPage from './pages/RecoveryPage';
import WastePage from './pages/WastePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import { EmptyState } from './components/ui/States';

export default function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="app" element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="sonar" element={<SonarPage />} />
        <Route path="detections" element={<DetectionsPage />} />
        <Route path="map" element={<Map3DPage />} />
        <Route path="recovery" element={<RecoveryPage />} />
        <Route path="waste" element={<WastePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<EmptyState title="Page not found" body="This view does not exist. Use the sidebar to navigate." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
