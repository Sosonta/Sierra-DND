import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { SidebarLayout } from "./pages/SidebarLayout";
import { RequireAuth } from "./components/RequireAuth";

import { LandingPage } from "./pages/LandingPage";
import { CalendarPage } from "./pages/CalendarPage";
import { GuidesPage } from "./pages/GuidesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LoginPage } from "./pages/LoginPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { RequireRole } from "./components/RequireRole";
import { BlogPage } from "./pages/BlogPage";
import { BlogPostPage } from "./pages/BlogPostPage";
import { BlogEditorPage } from "./pages/BlogEditorPage";
import { applyAccent, applyTheme, loadLocalPrefs } from "./theme";
import "./index.css";
import "./App.css";


const prefs = loadLocalPrefs();
if (prefs.theme) applyTheme(prefs.theme);
if (prefs.accentColor) applyAccent(prefs.accentColor);

const base = import.meta.env.DEV ? "/" : "/Sierra-DND";

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
  <Route path="/calendar" element={<CalendarPage />} />
  <Route path="/profile" element={<ProfilePage />} />
<Route path="/blog" element={<BlogPage />} />
<Route path="/blog/new" element={<BlogEditorPage mode="new" />} />
<Route path="/blog/edit/:postId" element={<BlogEditorPage mode="edit" />} />
<Route path="/blog/:slug" element={<BlogPostPage />} />
  <Route
    path="/admin/users"
    element={
      <RequireRole role="Admin">
        <AdminUsersPage />
      </RequireRole>
    }
  />
</Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

