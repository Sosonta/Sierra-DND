import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

import logoPng from "../assets/logo.png";

function LogoMark({ size = 250 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        background: "var(--accent)",
        WebkitMaskImage: `url(${logoPng})`,
        maskImage: `url(${logoPng})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

type LandingEvent = {
  id: string;
  title: string;
  startAt: any;
  endAt: any | null;
  imageUrl: string | null;
  linkedBlogSlug: string | null;
};

type LandingPost = {
  id: string;
  title: string;
  slug: string;
  createdAt: any;
  tags?: string[];
};

function isTimestampLike(x: any) {
  return !!x && typeof x.toDate === "function";
}

function formatDateTime(tsLike: any) {
  if (!isTimestampLike(tsLike)) return "";
  const d = tsLike.toDate() as Date;
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(tsLike: any) {
  if (!isTimestampLike(tsLike)) return "";
  const d = tsLike.toDate() as Date;
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function LandingPage() {
  const [upcomingEvents, setUpcomingEvents] = useState<LandingEvent[]>([]);
  const [recentPosts, setRecentPosts] = useState<LandingPost[]>([]);

  useEffect(() => {
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);

    const qEvents = query(
      collection(db, "events"),
      where("startAt", ">=", Timestamp.fromDate(now)),
      where("startAt", "<=", Timestamp.fromDate(in30)),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(qEvents, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LandingEvent[];
      setUpcomingEvents(rows);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const now = new Date();
    const back14 = new Date(now);
    back14.setDate(back14.getDate() - 14);

    const qPosts = query(
      collection(db, "blogPosts"),
      where("createdAt", ">=", Timestamp.fromDate(back14)),
      where("createdAt", "<=", Timestamp.fromDate(now)),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(qPosts, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      // Only show posts that actually have a slug for linking
      setRecentPosts(
        rows
          .filter((p) => typeof p.slug === "string" && p.slug.trim().length > 0)
          .map((p) => ({
            id: p.id,
            title: p.title ?? p.slug,
            slug: p.slug,
            createdAt: p.createdAt,
            tags: p.tags ?? [],
          }))
      );
    });

    return () => unsub();
  }, []);

  const eventsEmptyText = useMemo(() => {
    if (upcomingEvents.length) return null;
    return "No events in the next 30 days.";
  }, [upcomingEvents.length]);

  const postsEmptyText = useMemo(() => {
    if (recentPosts.length) return null;
    return "No posts in the last 14 days.";
  }, [recentPosts.length]);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 32px)",
        display: "grid",
        placeItems: "center",
        padding: "24px 14px",
      }}
    >
      <div style={{ width: "min(1100px, 100%)", display: "grid", gap: 18 }}>
        {/* Logo + Header */}
        <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
          <LogoMark />
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              letterSpacing: 0.4,
              color: "var(--accent)",
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            Sierra D&amp;D
          </div>
        </div>

        {/* Two boxes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* Upcoming Events */}
          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Upcoming Events</div>
              <Link to="/calendar" className="small" style={{ textDecoration: "none" }}>
                View all
              </Link>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {upcomingEvents.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/calendar?event=${encodeURIComponent(ev.id)}`}
                  className="card"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: ev.imageUrl ? "46px 1fr" : "1fr",
                    gap: 10,
                    alignItems: "center",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  {ev.imageUrl ? (
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        overflow: "hidden",
                        background: "rgba(0,0,0,0.15)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <img
                        src={ev.imageUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          const frame = img.parentElement as HTMLDivElement | null;
                          if (frame) frame.style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                    <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>
                      {formatDateTime(ev.startAt)}
                    </div>

                    {/* Optional extra line: linked blog slug */}
                    {ev.linkedBlogSlug ? (
                      <div className="small" style={{ marginTop: 4, opacity: 0.85 }}>
                        Linked: /blog/{ev.linkedBlogSlug}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}

              {eventsEmptyText ? <div className="small">{eventsEmptyText}</div> : null}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Recent Posts</div>
              <Link to="/blog" className="small" style={{ textDecoration: "none" }}>
                View all
              </Link>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {recentPosts.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="card"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    padding: 10,
                    background: "rgba(255,255,255,0.02)",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, minWidth: 0 }}>{p.title}</div>
                    <div className="small" style={{ opacity: 0.9 }}>
                      {formatDate(p.createdAt)}
                    </div>
                  </div>
                  {(p.tags ?? []).length ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      {(p.tags ?? []).join(" • ")}
                    </div>
                  ) : null}
                </Link>
              ))}

              {postsEmptyText ? <div className="small">{postsEmptyText}</div> : null}
            </div>
          </div>
        </div>

        {/* Responsive fallback: stack on small screens */}
        <style>{`
          @media (max-width: 860px) {
            .landing-two-col {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
