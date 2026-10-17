/**
 * Helpers de coleções (issue #42) — `getOrCreate` substitui o padrão
 * `if (!map.has(k)) map.set(k, init); map.get(k)!`, que era a maior fonte de
 * non-null assertions do projeto (asserção que o compilador não prova e o
 * runtime não checa).
 */

/** valor do mapa para `key`, criando (e registrando) via `init` quando ainda não existe */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let val = map.get(key)
  if (val === undefined) {
    val = init()
    map.set(key, val)
  }
  return val
}
