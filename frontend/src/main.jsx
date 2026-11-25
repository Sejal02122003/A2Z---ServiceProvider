import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HelmetProvider } from 'react-helmet-async'
import { store } from './store/index.js'
import { SocketProvider } from './context/SocketContext.jsx'
import './index.css'
import './utils/disableZoom.js'
import App from './App.jsx'
import { launchedFromNotification, markAppLaunched } from './lib/splashSession.js'

// Landing anywhere other than /splash (deep link, notification tap, reload) counts as an
// already-launched session, so the splash never replays later in this session.
if (window.location.pathname !== '/splash' || launchedFromNotification()) {
  markAppLaunched()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <HelmetProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
      </HelmetProvider>
    </Provider>
  </StrictMode>,
)

