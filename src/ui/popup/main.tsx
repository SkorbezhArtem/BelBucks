import React from 'react'
import { createRoot } from 'react-dom/client'
import { PopupApp } from './popupApp'
import '../ui.css'

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)

