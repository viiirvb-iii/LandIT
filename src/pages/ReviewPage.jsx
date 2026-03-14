import React, { useRef, useEffect, useMemo } from 'react';
import { JOBS, BOARDING_PASSES } from '../data/jobs';
import './ReviewPage.css';

/* ── Status helpers ── */
const STATUS_COLORS = {
  landed:   '#30d158',
  inflight: '#ffd60a',
  departed: '#ff453a',
  wishlist: 'rgba(255,255,255,0.2)',
};

/* ── Build globe node list from boarding passes + jobs ── */
function buildNodes(passes) {
  const angleStep = 360 / Math.max(passes.length, 1);
  return passes.map((bp, i) => {
    const job = JOBS.find(j => j.id === bp.jobId);
    const angle = i * angleStep + 20;
    const r = 65 + (i % 3) * 15;
    return {
      name: job?.company ?? bp.jobId,
      angle,
      r,
      status: bp.status,
      color: STATUS_COLORS[bp.status] ?? 'rgba(255,255,255,0.2)',
    };
  });
}

/* ── Globe Canvas ── */
function GlobeCanvas({ passes }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const animTRef  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 320;
    const H   = canvas.offsetHeight || 260;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const cy = H / 2 + 8;

    const nodes = buildNodes(passes);

    /* fixed star positions */
    const STARS = [
      [20,20],[55,35],[90,18],[150,45],[200,22],[260,38],[300,15],
      [35,80],[110,90],[190,70],[270,85],[310,55],
      [45,140],[95,160],[180,145],[250,155],[305,130],
    ];

    function draw() {
      const t = animTRef.current;
      ctx.clearRect(0, 0, W, H);

      /* ── deep space background ── */
      const bgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
      bgG.addColorStop(0,   '#0d1830');
      bgG.addColorStop(0.6, '#070e1e');
      bgG.addColorStop(1,   '#030810');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);

      /* ── stars ── */
      STARS.forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(t * 0.03 + sx)})`;
        ctx.fill();
      });

      /* ── outer glow ── */
      const glow = ctx.createRadialGradient(cx, cy, 90, cx, cy, 125);
      glow.addColorStop(0,   'rgba(58,130,246,0)');
      glow.addColorStop(0.7, 'rgba(58,130,246,0.04)');
      glow.addColorStop(1,   'rgba(58,130,246,0.10)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 125, 0, Math.PI * 2); ctx.fill();

      /* ── concentric rings ── */
      [38, 58, 78, 98, 112].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(58,130,246,${0.04 + i * 0.015})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      /* ── spokes ── */
      for (let a = 0; a < 360; a += 45) {
        const rad = a * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * 115, cy + Math.sin(rad) * 115);
        ctx.strokeStyle = 'rgba(58,130,246,0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* ── centre pulse ── */
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16 + pulse * 6);
      cg.addColorStop(0, 'rgba(58,130,246,0.55)');
      cg.addColorStop(1, 'rgba(58,130,246,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, 22 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a82f6';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

      /* ── paths + nodes ── */
      nodes.forEach(co => {
        const rad = co.angle * Math.PI / 180;
        const nx  = cx + Math.cos(rad) * co.r;
        const ny  = cy + Math.sin(rad) * co.r;
        const cp1x = cx + Math.cos(rad - 0.45) * co.r * 0.5;
        const cp1y = cy + Math.sin(rad - 0.45) * co.r * 0.5;

        /* path */
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cp1x, cp1y, nx, ny);
        if (co.status === 'landed')        { ctx.strokeStyle = 'rgba(48,209,88,0.45)';  ctx.setLineDash([]); }
        else if (co.status === 'inflight') { ctx.strokeStyle = 'rgba(255,214,10,0.4)';  ctx.setLineDash([5, 3]); }
        else if (co.status === 'departed') { ctx.strokeStyle = 'rgba(255,69,58,0.35)';  ctx.setLineDash([2, 4]); }
        else                               { ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([1, 5]); }
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        /* animated plane on inflight */
        if (co.status === 'inflight') {
          const tt  = (t % 100) / 100;
          const bx  = cx * (1 - tt) * (1 - tt) + cp1x * 2 * (1 - tt) * tt + nx * tt * tt;
          const by  = cy * (1 - tt) * (1 - tt) + cp1y * 2 * (1 - tt) * tt + ny * tt * tt;
          const btx = 2 * (1 - tt) * (cp1x - cx) + 2 * tt * (nx - cp1x);
          const bty = 2 * (1 - tt) * (cp1y - cy) + 2 * tt * (ny - cp1y);
          const ang = Math.atan2(bty, btx);
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(ang);
          ctx.fillStyle = '#ffd60a';
          ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -2.5); ctx.lineTo(-3, 0); ctx.lineTo(-4, 2.5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(-3, -5); ctx.lineTo(-5, -5); ctx.lineTo(-3, -1.5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(-3, 5); ctx.lineTo(-5, 5); ctx.lineTo(-3, 1.5); ctx.closePath(); ctx.fill();
          ctx.restore();
        }

        /* node glow */
        if (co.status !== 'wishlist') {
          const pg = ctx.createRadialGradient(nx, ny, 0, nx, ny, 10);
          pg.addColorStop(0, co.color.startsWith('rgba') ? co.color : co.color + '4d');
          pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.arc(nx, ny, 10, 0, Math.PI * 2); ctx.fill();
        }

        /* node circle */
        ctx.beginPath();
        ctx.arc(nx, ny, 5, 0, Math.PI * 2);
        ctx.fillStyle = co.color;
        ctx.fill();
        if (co.status !== 'wishlist') {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        /* label */
        ctx.fillStyle   = co.status === 'wishlist' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)';
        ctx.font        = '500 9px Inter, sans-serif';
        ctx.textAlign   = nx < cx ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(co.name, nx + (nx < cx ? -10 : 10), ny + (ny < cy ? -9 : 14));
      });

      animTRef.current++;
      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [passes]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

/* ── Boarding Pass Card ── */
const STATUS_META = {
  landed:   { label: 'LANDED',    cls: 'landed'   },
  inflight: { label: 'IN-FLIGHT', cls: 'inflight' },
  departed: { label: 'DEPARTED',  cls: 'departed' },
};

function BoardingPassCard({ job, pass, jobIndex, onOpenCoach, onToast }) {
  const meta = STATUS_META[pass.status] || STATUS_META.departed;

  return (
    <div className="pass-card">
      {pass.hasUnread && <div className="unread-dot" />}

      <div className="pass-top">
        <div className="pass-logo" style={{ background: job.color }}>{job.logo}</div>
        <div className="pass-info">
          <div className="pass-co">{job.company}</div>
          <div className="pass-role">{job.role}</div>
        </div>
        <span className={`pass-status ps-${meta.cls === 'landed' ? 'green' : meta.cls === 'inflight' ? 'amber' : 'red'}`}>
          {meta.label}
        </span>
      </div>

      <div className="pass-perf">
        <div className="perf-dot-l" />
        <div className="perf-line" />
        <div className="perf-dot-r" />
      </div>

      <div className="pass-strip">
        <div className="ps-field">
          <span className="ps-lbl">Pay</span>
          <span className="ps-val">{job.salary}</span>
        </div>
        <div className="ps-div" />
        <div className="ps-field">
          <span className="ps-lbl">Deadline</span>
          <span className="ps-val">{job.deadline}</span>
        </div>
        <div className="ps-div" />
        <div className="ps-field">
          <span className="ps-lbl">Applied</span>
          <span className="ps-val">{pass.appliedDate}</span>
        </div>
        <div className="ps-match">{job.match}%</div>
      </div>

      <div className="pass-actions">
        <button className="pa-btn pa-coach" onClick={() => onOpenCoach(jobIndex)}>Coach</button>
        <button className="pa-btn pa-detail" onClick={() => onToast(`Opening ${job.company} details`)}>Details</button>
        <button className="pa-btn pa-dl" onClick={() => onToast(`Exporting ${job.company} pass`)}>Export</button>
      </div>
    </div>
  );
}

/* ── ReviewPage ── */
export default function ReviewPage({ onOpenCoach, onToast }) {
  const enriched = useMemo(
    () =>
      BOARDING_PASSES.map(bp => {
        const job      = JOBS.find(j => j.id === bp.jobId);
        const jobIndex = JOBS.findIndex(j => j.id === bp.jobId);
        return { pass: bp, job, jobIndex };
      }).filter(e => e.job),
    [],
  );

  return (
    <div className="review-page">
      {/* Globe */}
      <div className="review-top">
        <GlobeCanvas passes={BOARDING_PASSES} />
        <div className="globe-legend">
          <div className="leg-item"><span className="leg-dot" style={{ background: '#30d158' }} />Landed</div>
          <div className="leg-item"><span className="leg-dot" style={{ background: '#ffd60a' }} />In-flight</div>
          <div className="leg-item"><span className="leg-dot" style={{ background: '#ff453a' }} />Departed</div>
        </div>
      </div>

      {/* Boarding passes */}
      <div className="review-bottom">
        <div className="passes-header">
          <span className="passes-title">Boarding Passes</span>
          <span className="passes-count">{enriched.length} applications</span>
        </div>

        {enriched.length === 0 ? (
          <div className="review-empty">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🛫</div>
            <div style={{ fontSize: 14, color: 'var(--t3)' }}>No applications yet. Start swiping!</div>
          </div>
        ) : (
          enriched.map(({ pass, job, jobIndex }) => (
            <BoardingPassCard
              key={pass.jobId}
              job={job}
              pass={pass}
              jobIndex={jobIndex}
              onOpenCoach={onOpenCoach}
              onToast={onToast}
            />
          ))
        )}
      </div>
    </div>
  );
}
