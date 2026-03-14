import React from "react";
import "./Passport.css";

const STAMP_VARIANTS = ["filled", "gold", "empty"];

function getStampVariant(stamp) {
  if (!stamp || !stamp.label) return "empty";
  if (stamp.variant) return stamp.variant;
  return "filled";
}

export default function Passport({ open, onClose, data }) {
  if (!data) return null;

  const {
    name,
    country,
    from,
    to,
    flight,
    gate,
    class: seatClass,
    season,
    degree,
    university,
    year,
    resumeUpdated,
    searching,
    locations,
    fields,
    swipedToday,
    tailorsLeft,
    stamps = [],
  } = data;

  // Ensure we always render 6 stamp slots
  const stampSlots = Array.from({ length: 6 }, (_, i) => stamps[i] || null);

  return (
    <div className={`passport-overlay${open ? " open" : ""}`}>
      {/* Header */}
      <div className="passport-header">
        <span className="passport-header-title">Passport</span>
        <button
          className="passport-close-btn"
          onClick={onClose}
          aria-label="Close passport"
        >
          &times;
        </button>
      </div>

      {/* Scrollable content */}
      <div className="passport-content">
        {/* Passport cover card */}
        <div className="passport-cover">
          <div className="passport-cover-label">
            landed &middot; passenger document
          </div>
          <div className="passport-cover-country">{country}</div>
          <div className="passport-cover-name">{name}</div>

          <div className="passport-cover-route">
            <span className="passport-cover-route-city">{from}</span>
            <svg
              className="passport-cover-route-arrow"
              width="28"
              height="12"
              viewBox="0 0 28 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 6h22m0 0l-5-5m5 5l-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="passport-cover-route-city">{to}</span>
          </div>

          <div className="passport-cover-fields">
            <div>
              <div className="passport-cover-field-label">Flight</div>
              <div className="passport-cover-field-value">{flight}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Gate</div>
              <div className="passport-cover-field-value">{gate}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Class</div>
              <div className="passport-cover-field-value">{seatClass}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Season</div>
              <div className="passport-cover-field-value">{season}</div>
            </div>
          </div>
        </div>

        {/* Static profile */}
        <div className="passport-card">
          <div className="passport-card-title">Static profile</div>

          <div className="passport-info-row">
            <span className="passport-info-label">Degree</span>
            <span className="passport-info-value">{degree}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">University</span>
            <span className="passport-info-value">{university}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Year</span>
            <span className="passport-info-value">{year}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Base resume</span>
            <span className="passport-info-value">
              {resumeUpdated || "Not set"}
            </span>
          </div>
        </div>

        {/* This session */}
        <div className="passport-card">
          <div className="passport-card-title">This session</div>

          <div className="passport-info-row">
            <span className="passport-info-label">Searching for</span>
            <span className="passport-info-value">{searching}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Locations</span>
            <span className="passport-info-value">
              {Array.isArray(locations) ? locations.join(", ") : locations}
            </span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Fields</span>
            <span className="passport-info-value">
              {Array.isArray(fields) ? fields.join(", ") : fields}
            </span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Swiped today</span>
            <span className="passport-info-value">{swipedToday}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">AI tailors left</span>
            <span className="passport-info-value">{tailorsLeft}</span>
          </div>
        </div>

        {/* Application stamps */}
        <div className="passport-card">
          <div className="passport-card-title">Application stamps</div>

          <div className="passport-stamps-grid">
            {stampSlots.map((stamp, i) => {
              const variant = getStampVariant(stamp);
              return (
                <div key={i} className={`passport-stamp passport-stamp--${variant}`}>
                  {stamp ? stamp.label : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
