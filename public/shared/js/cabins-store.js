let cabins = [];
let loadedAt = 0;

export function setCabins(next) {
  cabins = Array.isArray(next) ? next.slice() : [];
  loadedAt = Date.now();
  if (typeof window !== 'undefined') {
    window.__cabins = cabins;
  }
}

export async function loadCabins() {
  const res = await fetch('/api/cabins');
  const data = await res.json().catch(() => null);
  const list = data && Array.isArray(data.cabins) ? data.cabins : [];
  setCabins(list);
  return cabins;
}

export function getCabins() {
  return cabins;
}

export function getCabinDisplayNumber(cabinId) {
  const id = parseInt(cabinId, 10);
  const c = cabins.find(x => parseInt(x.id, 10) === id);
  const n = c ? parseInt(c.number, 10) : NaN;
  return Number.isFinite(n) ? n : id;
}

export function getCabinDisplayName(cabinId) {
  const id = parseInt(cabinId, 10);
  const c = cabins.find(x => parseInt(x.id, 10) === id);
  return c && c.name ? String(c.name) : `Кабинка ${getCabinDisplayNumber(id)}`;
}

export function getCabinsSortedByNumber() {
  return cabins.slice().sort((a, b) => {
    const an = Number.isFinite(parseInt(a.number, 10)) ? parseInt(a.number, 10) : parseInt(a.id, 10);
    const bn = Number.isFinite(parseInt(b.number, 10)) ? parseInt(b.number, 10) : parseInt(b.id, 10);
    if (an !== bn) return an - bn;
    return parseInt(a.id, 10) - parseInt(b.id, 10);
  });
}

export function getCabinsLoadedAt() {
  return loadedAt;
}

if (typeof window !== 'undefined') {
  window.setCabins = setCabins;
  window.loadCabins = loadCabins;
  window.getCabins = getCabins;
  window.getCabinDisplayNumber = getCabinDisplayNumber;
  window.getCabinDisplayName = getCabinDisplayName;
  window.getCabinsSortedByNumber = getCabinsSortedByNumber;
}

