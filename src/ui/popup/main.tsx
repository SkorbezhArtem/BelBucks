import React from 'react'
import { createRoot } from 'react-dom/client'
import { getSettings } from '../../shared/storage'
import { applyUiThemeMode } from '../theme'
import { PopupApp } from './popupApp'
import '../ui.css'

// Apply the chosen UI theme as early as possible to avoid a flash of the
// "wrong" theme before React mounts.
void getSettings().then((s) => applyUiThemeMode(s.uiThemeMode))

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)

