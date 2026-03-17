import { createRoot } from 'react-dom/client';
import { SpatialProvider } from 'exocor';
import App from './app/App.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <SpatialProvider>
    <App />
  </SpatialProvider>
);

