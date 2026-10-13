const KEY = 'nura.favorites'

export function loadFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.map(x => String(x).toLowerCase()) : []
  } catch {
    return []
  }
}

export function saveFavorites(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // private window
  }
}

export function toggleFav(list, ca) {
  const c = String(ca || '').toLowerCase()
  if (!c) return list
  return list.includes(c) ? list.filter(x => x !== c) : [...list, c]
}
