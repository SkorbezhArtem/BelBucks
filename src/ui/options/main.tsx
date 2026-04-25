import React from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsApp } from './optionsApp'
import '../ui.css'

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
)

