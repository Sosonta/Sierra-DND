import { useNavigate } from "react-router-dom";

export function BlogNewPage() {
  const navigate = useNavigate();

  return (
    <div className="card">
      <div>
  <button onClick={() => navigate("/blog")}>
    Cancel
  </button>
</div>
      <h1>New Post</h1>
      <div className="small">Next step: post editor + publish flow.</div>
    </div>
  );
}
