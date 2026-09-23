import Starfield from '../components/landing/Starfield.jsx';
import Nav from '../components/landing/Nav.jsx';
import Hero from '../components/landing/Hero.jsx';
import Marquee from '../components/landing/Marquee.jsx';
import About from '../components/landing/About.jsx';
import Experience from '../components/landing/Experience.jsx';
import GalleryScroll from '../components/landing/GalleryScroll.jsx';
import Team from '../components/landing/Team.jsx';
import Downloads from '../components/landing/Downloads.jsx';
import Footer from '../components/landing/Footer.jsx';
import CursorTrail from '../components/landing/CursorTrail.jsx';

/**
 * Public landing page - one long scrolling page with section anchors.
 */
export default function Landing() {
  return (
    <>
      <Starfield />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Experience />
        <GalleryScroll />
        <Team />
        <Downloads />
      </main>
      <Footer />
      <CursorTrail />
    </>
  );
}
