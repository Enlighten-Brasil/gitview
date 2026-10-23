// catálogo es-ES — LAZY: carregado por import() no bootstrap, vira chunk
// próprio por locale (só baixado quando o locale resolve pra es-ES)
import app from './app.json'
import branches from './branches.json'
import chart from './chart.json'
import filters from './filters.json'
import nav from './nav.json'
import navbar from './navbar.json'
import team from './team.json'

export default { ...app, ...branches, ...chart, ...filters, ...nav, ...navbar, ...team }
