import { createApp } from 'vue'
import { marked } from 'marked'
import './styles/tokens.css'
import App from './App.vue'

marked.setOptions({
  breaks: true,
  gfm: true
})

createApp(App).mount('#app')
