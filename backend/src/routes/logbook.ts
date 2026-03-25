import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import db from '../db/database';

const router = Router();

interface TripRow {
  id: number;
  start_time: number;
  end_time: number | null;
  start_address: string | null;
  end_address: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  category: string;
  notes: string | null;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function fmtKm(km: number | null) {
  return km != null ? km.toFixed(1) : '—';
}

// GET /api/logbook/pdf?year=2025&category=business
router.get('/pdf', (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const category = (req.query.category as string) || 'business';

  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd   = new Date(year + 1, 0, 1).getTime();

  const trips = db.prepare(
    `SELECT * FROM trips
     WHERE start_time >= ? AND start_time < ?
       AND end_time IS NOT NULL
       AND category = ?
     ORDER BY start_time ASC`
  ).all(yearStart, yearEnd, category) as TripRow[];

  const totalKm = trips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const pauschale = totalKm * 0.30;
  const categoryLabel = category === 'business' ? 'Berufliche' : 'Private';

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="fahrtenbuch-${year}.pdf"`);
  doc.pipe(res);

  // ── Colors / helpers ────────────────────────────────────────────────
  const DARK    = '#1a1a2e';
  const ACCENT  = '#007AFF';
  const LIGHT   = '#f0f4f8';
  const GRAY    = '#6e6e73';
  const ROW_ALT = '#f8fafc';

  const W = doc.page.width  - 80; // usable width
  const COL = {
    nr:    40,
    date:  55,
    time:  90,
    from:  160,
    to:    160,
    km:    55,
    notes: 0,  // fills remaining
  };
  COL.notes = W - COL.nr - COL.date - COL.time - COL.from - COL.to - COL.km;

  // ── Header ──────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 60).fill(DARK);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
     .text('Fahrtenbuch', 40, 16);
  doc.fillColor('#aaaacc').font('Helvetica').fontSize(11)
     .text(`${categoryLabel} Fahrten · Jahr ${year}`, 40, 40);

  // right: stats
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
     .text(`${trips.length} Fahrten`, doc.page.width - 250, 14, { width: 200, align: 'right' });
  doc.fillColor('#aaaacc').font('Helvetica').fontSize(10)
     .text(`${totalKm.toFixed(1)} km gesamt`, doc.page.width - 250, 32, { width: 200, align: 'right' });
  if (category === 'business') {
    doc.fillColor('#5bd75b').font('Helvetica-Bold').fontSize(10)
       .text(`0,30 €/km = ${pauschale.toFixed(2)} €`, doc.page.width - 250, 47, { width: 200, align: 'right' });
  }

  let y = 75;

  // ── Table header ────────────────────────────────────────────────────
  function drawTableHeader() {
    doc.rect(40, y, W, 20).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    let x = 40;
    const headers = ['Nr.', 'Datum', 'Zeit', 'Von', 'Nach', 'km', 'Notiz / Zweck'];
    const widths  = [COL.nr, COL.date, COL.time, COL.from, COL.to, COL.km, COL.notes];
    headers.forEach((h, i) => {
      doc.text(h, x + 3, y + 5, { width: widths[i] - 4, align: i >= 5 ? 'right' : 'left' });
      x += widths[i];
    });
    y += 20;
  }

  drawTableHeader();

  // ── Table rows ──────────────────────────────────────────────────────
  trips.forEach((trip, idx) => {
    const rowH = 18;

    // page break
    if (y + rowH > doc.page.height - 60) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
      y = 40;
      drawTableHeader();
    }

    const bg = idx % 2 === 0 ? '#ffffff' : ROW_ALT;
    doc.rect(40, y, W, rowH).fill(bg);

    doc.fillColor(DARK).font('Helvetica').fontSize(8);
    let x = 40;

    const from = trip.start_address ? trip.start_address.split(',')[0] : '—';
    const to   = trip.end_address   ? trip.end_address.split(',')[0]   : '—';
    const time = `${fmtTime(trip.start_time)}${trip.end_time ? `–${fmtTime(trip.end_time)}` : ''}`;

    const cells = [
      { text: String(idx + 1),       w: COL.nr,    align: 'right' as const },
      { text: fmtDate(trip.start_time), w: COL.date, align: 'left' as const },
      { text: time,                  w: COL.time,  align: 'left' as const },
      { text: from,                  w: COL.from,  align: 'left' as const },
      { text: to,                    w: COL.to,    align: 'left' as const },
      { text: fmtKm(trip.distance_km), w: COL.km,  align: 'right' as const },
      { text: trip.notes || '',      w: COL.notes, align: 'left' as const },
    ];

    cells.forEach(c => {
      doc.text(c.text, x + 3, y + 5, { width: c.w - 4, align: c.align, ellipsis: true, lineBreak: false });
      x += c.w;
    });

    // bottom border
    doc.moveTo(40, y + rowH).lineTo(40 + W, y + rowH).lineWidth(0.3).strokeColor('#e0e4ea').stroke();
    y += rowH;
  });

  // ── Summary box ─────────────────────────────────────────────────────
  if (y + 80 > doc.page.height - 40) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
    y = 40;
  }

  y += 16;
  doc.rect(40, y, W, category === 'business' ? 70 : 50).fill(LIGHT).stroke(ACCENT);

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text('Zusammenfassung', 52, y + 10);
  doc.font('Helvetica').fontSize(9).fillColor(GRAY)
     .text(`Zeitraum: 01.01.${year} – 31.12.${year}`, 52, y + 26)
     .text(`Anzahl ${categoryLabel.toLowerCase()} Fahrten: ${trips.length}`, 52, y + 39)
     .text(`Gesamtkilometer: ${totalKm.toFixed(1)} km`, 52, y + 52);

  if (category === 'business') {
    doc.font('Helvetica-Bold').fillColor(ACCENT).fontSize(10)
       .text(`Steuerliche Pauschale (0,30 €/km): ${pauschale.toFixed(2)} €`, 52, y + 65);
  }

  // ── Footer ──────────────────────────────────────────────────────────
  const pageCount = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer?.length ?? 1;
  doc.fillColor(GRAY).font('Helvetica').fontSize(8)
     .text(
       `Erstellt am ${new Date().toLocaleDateString('de-DE')} · MyAuto · Seite 1 von ${pageCount}`,
       40, doc.page.height - 30, { width: W, align: 'center' }
     );

  doc.end();
});

export default router;
