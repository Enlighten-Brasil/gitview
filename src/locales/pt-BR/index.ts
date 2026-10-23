// catálogo pt-BR — EAGER: import estático no i18n.ts, entra no bundle
// principal (é o locale default e o fallback de todos os demais).
// Chaves FLAT ('nav.sections.dashboards'): o resolver default do vue-i18n
// v11 (resolveWithKeyValue) não expande dot-path — lookup direto por chave.
import app from './app.json'
import branches from './branches.json'
import chart from './chart.json'
import filters from './filters.json'
import nav from './nav.json'
import navbar from './navbar.json'
import team from './team.json'
import ui from './ui.json'
export default { ...app, ...branches, ...chart, ...filters, ...nav, ...navbar, ...team, ...ui }
