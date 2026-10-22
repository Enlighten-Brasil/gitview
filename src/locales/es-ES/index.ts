// catálogo es-ES — LAZY: carregado por import() no bootstrap, vira chunk
// próprio por locale (só baixado quando o locale resolve pra es-ES)
import app from './app.json'
import filters from './filters.json'
import nav from './nav.json'
import navbar from './navbar.json'

export default { ...app, ...filters, ...nav, ...navbar }
