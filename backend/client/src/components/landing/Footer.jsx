import { NAV_LINKS } from './Nav.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="assets/logo.png" alt="" />
          <div>
            <strong>Virtual Campus Open Day</strong>
            <span>Explore Belgium Campus before you arrive.</span>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`}>{l.label}</a>
          ))}
          <a href="login.html">Staff login</a>
        </nav>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} Belgium Campus · PRJ381</div>
    </footer>
  );
}
