export default function Placeholder({ emoji, title, note }) {
  return (
    <div className="placeholder">
      <div className="emoji">{emoji}</div>
      <h1 className="h-screen">{title}</h1>
      <p className="sub">{note}</p>
      <a className="btn ghost" href="/legacy.html" style={{ textDecoration: 'none', marginTop: 8 }}>
        Open in classic app
      </a>
    </div>
  );
}
