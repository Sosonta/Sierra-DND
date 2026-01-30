import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { SidebarLayout } from "./layouts/SidebarLayout";
import { RequireAuth } from "./components/RequireAuth";

import { LandingPage } from "./pages/LandingPage";
import { BlogPage } from "./pages/BlogPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ForumPage } from "./pages/ForumPage";
import { GuidesPage } from "./pages/GuidesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LoginPage } from "./pages/LoginPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/Sierra-DND">
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <SidebarLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

