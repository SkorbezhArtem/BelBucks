import React from 'react'
import { createRoot } from 'react-dom/client'
import { getSettings } from '../../shared/storage'
import { applyUiThemeMode } from '../theme'
import { OptionsApp } from './optionsApp'
import '../ui.css'

void getSettings().then((s) => applyUiThemeMode(s.uiThemeMode))

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
)

