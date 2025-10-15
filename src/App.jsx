import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Protected from "./components/Protected.jsx";

import AdminLayout from "./layouts/AdminLayout.jsx";
import LoginLayout from "./layouts/LoginLayout.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Logs from "./pages/Logs.jsx";
import Maps from "./pages/Maps.jsx";
import ApiExplorer from "./pages/ApiExplorer.jsx";
import Apicc1 from "./pages/Apicc1.jsx";
import ApiBellaBot from "./pages/Apibella.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginLayout />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="logs" element={<Logs />} />
        <Route path="maps" element={<Maps />} />
        <Route path="explorer" element={<ApiExplorer />} />
        <Route path="apicc" element={<Apicc1 />} />
        <Route path="apibella" element={<ApiBellaBot />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
