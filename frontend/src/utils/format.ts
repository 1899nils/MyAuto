export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export function formatKm(km: number): string {
  return km >= 10 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
}

export function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

export function categoryLabel(cat: string): string {
  return cat === 'business' ? 'Beruflich' : cat === 'private' ? 'Privat' : 'Unklassifiziert';
}

export function categoryEmoji(cat: string): string {
  return cat === 'business' ? '💼' : cat === 'private' ? '🏠' : '❓';
}

export function liveElapsed(startTime: number): string {
  const secs = Math.round((Date.now() - startTime) / 1000);
  return formatDuration(secs);
}
