import React, { useRef, useEffect, useMemo } from 'react';
import { JOBS, BOARDING_PASSES } from '../data/jobs';
import './ReviewPage.css';

/* ── Status helpers ── */
const STATUS_META = {
  landed:   { label: 'LANDED',    cls: 'landed'   },
  inflight: { label: 'IN-FLIGHT', cls: 'inflight'  },
  departed: { label: 'DEPARTED',  cls: 'departed'  },
};

const STATUS_COLORS = {
  landed:   '#22c55e',
  inflight: '#f59e0b',
  departed: '#ef4444',
};

/* ── Globe Canvas ── */
function GlobeCanvas({ passes }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 480;
    const H = 240;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const cy = H / 2;

    /* Build nodes for each applied company */
    const nodes = passes.map((bp, i) => {
      const job = JOBS.find((j) => j.id === bp.jobId);
      const angle = (i / passes.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 70 + Math.random() * 20;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        letter: job?.logo || '?',
        color: job?.color || '#94a3b8',
        statusColor: STATUS_COLORS[bp.status] || '#94a3b8',
        phase: Math.random() * Math.PI * 2,
      };
    });

    /* Ambient dots */
    const dots = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    function draw() {
      t += 0.008;
      ctx.clearRect(0, 0, W, H);

      /* Ambient dots */
      dots.forEach((d) => {
        const alpha = 0.12 + 0.08 * Math.sin(t * 1.5 + d.phase);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${alpha})`;
        ctx.fill();
      });

      /* Center hub */
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();

      /* Draw connections + nodes */
      nodes.forEach((n) => {
        const wobbleX = Math.sin(t + n.phase) * 3;
        const wobbleY = Math.cos(t * 0.7 + n.phase) * 3;
        const nx = n.x + wobbleX;
        const ny = n.y + wobbleY;

        /* Curved connection line */
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const cpx = (cx + nx) / 2 + (ny - cy) * 0.2;
        const cpy = (cy + ny) / 2 - (nx - cx) * 0.2;
        ctx.quadraticCurveTo(cpx, cpy, nx, ny);
        ctx.strokeStyle = `rgba(59,130,246,${0.12 + 0.06 * Math.sin(t + n.phase)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        /* Node circle */
        ctx.beginPath();
        ctx.arc(nx, ny, 16, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        /* Status ring */
        ctx.beginPath();
        ctx.arc(nx, ny, 18, 0, Math.PI * 2);
        ctx.strokeStyle = n.statusColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        /* Letter */
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.letter, nx, ny);
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [passes]);

  return <canvas ref={canvasRef} />;
}

/* ── Boarding Pass Card ── */
function BoardingPassCard({ job, pass, jobIndex, onOpenCoach, onToast }) {
  const meta = STATUS_META[pass.status] || STATUS_META.departed;

  return (
    <div className="review-card">
      {/* Top: logo + info + status */}
      <div className="review-card-top">
        <div className="review-card-logo" style={{ background: job.color }}>
          {job.logo}
        </div>
        <div className="review-card-info">
          <div className="review-card-company">{job.company}</div>
          <div className="review-card-location">{job.location}</div>
          <div className="review-card-role">{job.role}</div>
        </div>
        <div className="review-card-status-area">
          {pass.hasUnread && <span className="review-unread-dot" />}
          <span className={`review-status-badge ${meta.cls}`}>{meta.label}</span>
        </div>
      </div>

      {/* Perforation divider */}
      <div className="review-perforation">
        <div className="review-perforation-line" />
        <div className="review-perforation-notch left" />
        <div className="review-perforation-notch right" />
      </div>

      {/* Stats strip */}
      <div className="review-stats-strip">
        <div className="review-stat">
          <div className="review-stat-label">Pay</div>
          <div className="review-stat-value">{job.salary}</div>
        </div>
        <div className="review-stat">
          <div className="review-stat-label">Deadline</div>
          <div className="review-stat-value">{job.deadline}</div>
        </div>
        <div className="review-stat">
          <div className="review-stat-label">Applied</div>
          <div className="review-stat-value">{pass.appliedDate}</div>
        </div>
        <div className="review-stat">
          <div className="review-stat-label">Match</div>
          <div className="review-stat-value">{job.match}%</div>
        </div>
      </div>

      {/* Actions */}
      <div className="review-actions">
        <button
          className="review-action-btn coach"
          onClick={() => onOpenCoach(jobIndex)}
        >
          Coach
        </button>
        <button
          className="review-action-btn details"
          onClick={() => onToast(`Opening ${job.company} details`)}
        >
          Details
        </button>
        <button
          className="review-action-btn export"
          onClick={() => onToast(`Exporting ${job.company} pass`)}
        >
          Export
        </button>
      </div>
    </div>
  );
}

/* ── ReviewPage ── */
export default function ReviewPage({ onOpenCoach, onToast }) {
  const enriched = useMemo(
    () =>
      BOARDING_PASSES.map((bp) => {
        const job = JOBS.find((j) => j.id === bp.jobId);
        const jobIndex = JOBS.findIndex((j) => j.id === bp.jobId);
        return { pass: bp, job, jobIndex };
      }).filter((e) => e.job),
    [],
  );

  return (
    <div className="review-page">
      {/* Globe visualisation */}
      <div className="review-globe-section">
        <GlobeCanvas passes={BOARDING_PASSES} />
        <div className="review-globe-title">Your Applications</div>
      </div>

      {/* Legend bar */}
      <div className="review-legend-bar">
        <div className="review-legend-item">
          <span className="review-legend-dot landed" />
          Landed
        </div>
        <div className="review-legend-item">
          <span className="review-legend-dot inflight" />
          In-flight
        </div>
        <div className="review-legend-item">
          <span className="review-legend-dot departed" />
          Departed
        </div>
        <div className="review-legend-item">
          <span className="review-legend-dot wishlist" />
          Wishlist
        </div>
      </div>

      {/* Boarding pass cards */}
      <div className="review-cards-list">
        {enriched.length === 0 ? (
          <div className="review-empty">
            <div className="review-empty-icon">boarding_pass</div>
            <div className="review-empty-text">
              No applications yet. Start swiping to apply!
            </div>
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
