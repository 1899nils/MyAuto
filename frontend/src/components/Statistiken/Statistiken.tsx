import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../api/client';
import { YearStats } from '../../types';
import { Skeleton, SkeletonStatCard } from '../ui/Skeleton';

const YEAR_RANGE = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

const CAT_COLORS: Record<string, string> = {
  business:     '#007AFF',
  private:      '#34C759',
  unclassified: '#8E8E93',
};
const CAT_LABELS: Record<string, string> = {
  business:     '💼 Beruflich',
  private:      '🏠 Privat',
  unclassified: '❓ Offen',
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function fmtKm(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

export function Statistiken() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<YearStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getYearStats(year)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  const pieData = (data?.byCategory ?? [])
    .filter(c => (c.km ?? 0) > 0)
    .map(c => ({
      name: CAT_LABELS[c.category] ?? c.category,
      value: Math.round((c.km ?? 0) * 10) / 10,
      color: CAT_COLORS[c.category] ?? '#aaa',
    }));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Statistiken</h1>
          <p className="page-subtitle">Jahresauswertung</p>
        </div>
        <div className="page-actions">
          <select
            className="form-input"
            style={{ width: 90, textAlign: 'center' }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {YEAR_RANGE.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
            <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
            <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
          </div>
          <div className="skeleton-card" style={{ height: 200, marginBottom: 'var(--sp-md)' }}>
            <Skeleton width="30%" height={12} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={140} radius={10} />
          </div>
        </>
      )}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
            {[
              { label: 'Fahrten',    value: String(data.totals.trips),       icon: '🚗' },
              { label: 'Gesamt km',  value: fmtKm(data.totals.km),           icon: '📍' },
              { label: 'Ø km/Fahrt', value: fmtKm(data.totals.avg_km),       icon: '📏' },
              { label: 'Längste',    value: fmtKm(data.totals.max_km),        icon: '🏆' },
              { label: 'Stunden',    value: data.totals.hours.toFixed(1) + ' h', icon: '⏱️' },
            ].map(kpi => (
              <div key={kpi.label} className="glass" style={{ padding: 'var(--sp-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 24 }}>{kpi.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{kpi.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Monthly km chart */}
          <div className="glass" style={{ padding: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--sp-md)' }}>Kilometer pro Monat</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${Number(v).toFixed(1)} km`]}
                />
                <Bar dataKey="business_km" stackId="a" fill="#007AFF" name="Beruflich" radius={[0, 0, 0, 0]} />
                <Bar dataKey="private_km"  stackId="a" fill="#34C759" name="Privat"    radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 'var(--sp-md)', justifyContent: 'center', marginTop: 'var(--sp-sm)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ color: '#007AFF' }}>■</span> Beruflich</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ color: '#34C759' }}>■</span> Privat</span>
            </div>
          </div>

          {/* Weekday + Pie row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
            {/* Weekday chart */}
            <div className="glass" style={{ padding: 'var(--sp-md)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--sp-md)' }}>Wochentage</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.weekdayData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${Number(v).toFixed(1)} km`]}
                  />
                  <Bar dataKey="km" fill="#FF9F0A" radius={[4, 4, 0, 0]} name="km" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category pie */}
            <div className="glass" style={{ padding: 'var(--sp-md)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--sp-sm)' }}>Kategorien</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} km`]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Keine Daten
                </div>
              )}
            </div>
          </div>

          {/* Kosten & Steuer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
            {/* Kosten */}
            <div className="glass" style={{ padding: 'var(--sp-md)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--sp-md)' }}>💰 Kosten {year}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
                {[
                  { label: `⛽ Sprit (${data.costs.fuel_liters.toFixed(1)} L)`, value: fmtEur(data.costs.fuel_eur) },
                  { label: `🔧 Wartung (${data.costs.maintenance_count}x)`,      value: fmtEur(data.costs.maintenance_eur) },
                  { label: 'Gesamt',                                               value: fmtEur(data.costs.total_eur), bold: true },
                  { label: `🌿 CO₂ (${data.costs.fuel_liters.toFixed(0)} L)`,    value: `${(data.costs.co2_kg ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} kg` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: row.bold ? 700 : 500, color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Steuer / Pauschale */}
            <div className="glass" style={{ padding: 'var(--sp-md)', background: 'linear-gradient(135deg, rgba(0,122,255,0.08), transparent)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--sp-md)' }}>📋 Steuer {year}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>💼 Berufliche km</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{fmtKm(data.tax.business_km)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Pauschale (0,30 €/km)</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{fmtEur(data.tax.business_km * 0.30)}</span>
                </div>
                <div style={{ marginTop: 'var(--sp-sm)', padding: 'var(--sp-sm)', borderRadius: 8, background: 'rgba(0,122,255,0.12)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Steuererstattung (ca.)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#007AFF', marginTop: 2 }}>
                    {fmtEur(data.tax.pauschale)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>Keine Daten</h3>
            <p>Für {year} liegen noch keine Fahrten vor.</p>
          </div>
        </div>
      )}
    </div>
  );
}
