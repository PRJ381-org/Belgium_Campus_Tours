import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '../styles/landing.css';
import Landing from '../pages/Landing.jsx';

createRoot(document.getElementById('root')).render(<Landing />);
