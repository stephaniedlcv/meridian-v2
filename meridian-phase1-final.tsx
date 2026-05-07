import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

// ── MERIDIAN DESIGN SYSTEM ────────────────────────────────────────────────────
// These tokens are non-negotiable. Do not change.
const DS = {
  bg: "#061316",
  card: "rgba(232,248,245,0.055)",
  card2: "rgba(232,248,245,0.085)",
  border: "rgba(103,232,249,0.13)",
  border2: "rgba(45,212,191,0.26)",
  text: "#EAFBF7",
  textSoft: "#9ACBC1",
  textMuted: "#5F8E85",
  teal: "#2DD4BF",
  cyan: "#67E8F9",
  green: "#4ADE80",
  amber: "#FCD34D",
  red: "#F87171",
  purple: "#A78BFA",
};

// ── GOOGLE FONTS ──────────────────────────────────────────────────────────────
// Inject Fraunces + Plus Jakarta Sans if not already loaded
if (typeof document !== "undefined") {
  const linkId = "meridian-fonts";
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }
}

// ── ICON PATHS ────────────────────────────────────────────────────────────────
const iconPaths = {
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  flask: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H3m6 0h12m-6 7v-7",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  insights: "M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6L15 17H9l-.7-2C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7zM9 21h6M10 17v4M14 17v4",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
};

function Icon({ name, size = 16, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function toTitleCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseNumericValue(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?[0-9]+([.][0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function getRangePercent(value, range) {
  const numeric = parseNumericValue(value);
  if (numeric === null || !range || range.scaleMax <= range.scaleMin) return 50;
  const raw = ((numeric - range.scaleMin) / (range.scaleMax - range.scaleMin)) * 100;
  return Math.max(2, Math.min(98, raw));
}

function getBandPercent(value, range) {
  if (!range || range.scaleMax <= range.scaleMin) return 0;
  const raw = ((value - range.scaleMin) / (range.scaleMax - range.scaleMin)) * 100;
  return Math.max(0, Math.min(100, raw));
}

function getLabStatusDates(lab) {
  const next = lab.nextDue ? new Date(lab.nextDue) : null;
  const now = new Date();
  const daysUntilDue = next ? Math.ceil((next - now) / (1000 * 60 * 60 * 24)) : null;
  return {
    formattedDate: formatDate(lab.date),
    formattedNext: lab.nextDue ? formatDate(lab.nextDue) : null,
    overdue: Boolean(next && now > next),
    dueSoon: Boolean(daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 60),
    daysUntilDue,
  };
}

function getLatestActiveLabs(labs) {
  const grouped = new Map();
  labs
    .filter((item) => item.visibility !== "archived")
    .forEach((item) => {
      const existing = grouped.get(item.marker);
      if (!existing || new Date(item.date || 0) > new Date(existing.date || 0)) {
        grouped.set(item.marker, item);
      }
    });
  return Array.from(grouped.values());
}

function getArchivedLabs(labs) {
  return labs.filter((item) => item.visibility === "archived");
}

// ── MARKER DEFINITIONS + ARBITRATOR ──────────────────────────────────────────
const markerDefinitions = {
  TSH:              { id: "tsh",           system: "Thyroid",        priorityWeight: 4, riskProfile: "u-shaped",     actionDomain: "recovery-consistency" },
  HbA1c:            { id: "hba1c",         system: "Metabolic",      priorityWeight: 4, riskProfile: "linear-high",  actionDomain: "glucose-stability" },
  Glucose:          { id: "glucose",       system: "Metabolic",      priorityWeight: 3, riskProfile: "u-shaped",     actionDomain: "glucose-stability" },
  "Vitamin D":      { id: "vitamin-d",     system: "Micronutrients", priorityWeight: 2, riskProfile: "linear-low",   actionDomain: "recovery-support" },
  "Vitamin B12":    { id: "vitamin-b12",   system: "Micronutrients", priorityWeight: 2, riskProfile: "u-shaped",     actionDomain: "supplement-context" },
  HDL:              { id: "hdl",           system: "Cardiovascular", priorityWeight: 2, riskProfile: "linear-low",   actionDomain: "cardio-metabolic" },
  LDL:              { id: "ldl",           system: "Cardiovascular", priorityWeight: 3, riskProfile: "linear-high",  actionDomain: "cardio-metabolic" },
  Triglycerides:    { id: "triglycerides", system: "Cardiovascular", priorityWeight: 3, riskProfile: "linear-high",  actionDomain: "cardio-metabolic" },
  AST:              { id: "ast",           system: "Liver",          priorityWeight: 4, riskProfile: "linear-high",  actionDomain: "metabolic-load" },
  ALT:              { id: "alt",           system: "Liver",          priorityWeight: 4, riskProfile: "linear-high",  actionDomain: "metabolic-load" },
  eGFR:             { id: "egfr",          system: "Kidney",         priorityWeight: 3, riskProfile: "linear-low",   actionDomain: "hydration-recovery" },
  Creatinine:       { id: "creatinine",    system: "Kidney",         priorityWeight: 3, riskProfile: "linear-high",  actionDomain: "hydration-recovery" },
  "Uric Acid":      { id: "uric-acid",     system: "Metabolic",      priorityWeight: 3, riskProfile: "linear-high",  actionDomain: "hydration-metabolic" },
};

function getMarkerDefinition(marker) {
  const fallbackId = String(marker || "unknown").toLowerCase().split(" ").join("-");
  return markerDefinitions[marker] || { id: fallbackId, system: "General", priorityWeight: 1, riskProfile: "context", actionDomain: "general" };
}

function getPriorityScore(labItem) {
  const severityScore = { Optimal: 0, Watch: 1, Attention: 2, Critical: 3 }[labItem.state] ?? 0;
  const trendScore = { up: -1, stable: 0, watch: 1, down: 1 }[labItem.trend] ?? 0;
  const definition = getMarkerDefinition(labItem.marker);
  const followUpScore = labItem.nextDue ? 1 : 0;
  return severityScore * 5 + trendScore * 3 + definition.priorityWeight + followUpScore;
}

function getDominantLabSignal(labs) {
  const active = getLatestActiveLabs(labs).filter((item) => item.state !== "Optimal");
  if (active.length === 0) return null;
  return [...active].sort((a, b) => getPriorityScore(b) - getPriorityScore(a))[0];
}

function generateDominantAction(user, signal) {
  if (!signal) return user.actions?.[0] || "Maintain your current routine";
  const definition = getMarkerDefinition(signal.marker);
  const actionMap = {
    "recovery-consistency": "Stabilize recovery through consistent sleep, stress, and training rhythm",
    "glucose-stability":    "Stabilize glucose today with a post-meal walk and steady meals",
    "recovery-support":     "Support recovery basics before increasing intensity",
    "supplement-context":   "Review supplementation context before making changes",
    "cardio-metabolic":     "Prioritize a low-intensity walk and a fiber-forward meal today",
    "metabolic-load":       "Reduce metabolic load today with simple meals and gentle movement",
    "hydration-recovery":   "Prioritize hydration and recovery consistency today",
    "hydration-metabolic":  "Prioritize hydration and reduce high-purine load today",
    general:                user.actions?.[0] || "Maintain your current routine",
  };
  return actionMap[definition.actionDomain] || actionMap.general;
}

function getResultLabel(labItem) {
  if (!labItem.previous || labItem.previous === "Not available") return "Current level";
  return "Latest result";
}

function normalizeTrustLine(trust) {
  const suffix = "Meridian interprets, you decide";
  if (!trust) return suffix;
  if (trust.includes(suffix)) return trust;
  const cleaned = trust.trim().endsWith("·") ? trust.trim().slice(0, -1).trim() : trust.trim();
  return cleaned + " · " + suffix;
}

function getVisibleSupportingActions(actions) {
  return Array.isArray(actions) ? actions.slice(1, 3) : [];
}

// ── VERSION ───────────────────────────────────────────────────────────────────
const MERIDIAN_VERSION = "Phase 1 · v7";

// ── GROUP LABS BY SYSTEM ──────────────────────────────────────────────────────
function groupLabsBySystem(labs) {
  const groups = {};
  labs.forEach((labItem) => {
    const system = labItem.system || getMarkerDefinition(labItem.marker).system || "General";
    if (!groups[system]) groups[system] = [];
    groups[system].push(labItem);
  });
  // Sort each group by priority score descending
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  });
  return groups;
}
const mockExtractedLabs = [
  { marker: "TSH",         detectedValue: "3.03", unit: "mIU/L", statusPreview: "Watch",   impact: "Keeps your Thyroid signal in Watch — still above your personal 1.69 baseline." },
  { marker: "Vitamin B12", detectedValue: "1081", unit: "pg/mL", statusPreview: "Watch",   impact: "Keeps Micronutrients in Watch until supplementation context is reviewed." },
  { marker: "HbA1c",       detectedValue: "4.80", unit: "%",     statusPreview: "Optimal", impact: "Supports your Metabolic signal remaining Optimal." },
];

// ── RANGES (unchanged) ────────────────────────────────────────────────────────
const ranges = {
  vitaminD: { scaleMin: 0, scaleMax: 100, normalMin: 20, normalMax: 100, optimalMin: 30, optimalMax: 50, label: "Normal ≥20 · optimal 30–50" },
  hba1c: { scaleMin: 4.5, scaleMax: 6.5, normalMin: 0, normalMax: 5.6, optimalMin: 4.8, optimalMax: 5.3, label: "Normal <5.7 · optimal 4.8–5.3" },
  glucose: { scaleMin: 60, scaleMax: 140, normalMin: 70, normalMax: 99, optimalMin: 75, optimalMax: 90, label: "Normal 70–99 · optimal 75–90" },
  tsh: { scaleMin: 0, scaleMax: 5, normalMin: 0.4, normalMax: 4.5, optimalMin: 0.8, optimalMax: 2.5, label: "Typical 0.4–4.5 · optimal 0.8–2.5" },
  totalChol: { scaleMin: 100, scaleMax: 300, normalMin: 0, normalMax: 199, optimalMin: 125, optimalMax: 180, label: "Normal <200 · optimal 125–180" },
  ldl: { scaleMin: 40, scaleMax: 190, normalMin: 0, normalMax: 129, optimalMin: 0, optimalMax: 99, label: "Optimal <100 · borderline 130–159" },
  hdl: { scaleMin: 20, scaleMax: 90, normalMin: 40, normalMax: 90, optimalMin: 50, optimalMax: 80, label: "Typical ≥40 · optimal ≥50" },
  tg: { scaleMin: 50, scaleMax: 300, normalMin: 0, normalMax: 149, optimalMin: 50, optimalMax: 100, label: "Normal <150 · optimal 50–100" },
  ast: { scaleMin: 0, scaleMax: 120, normalMin: 0, normalMax: 40, optimalMin: 10, optimalMax: 30, label: "Typical ≤40 · optimal 10–30" },
  alt: { scaleMin: 0, scaleMax: 120, normalMin: 0, normalMax: 45, optimalMin: 10, optimalMax: 30, label: "Typical ≤45 · optimal 10–30" },
  creatinineF: { scaleMin: 0.4, scaleMax: 1.5, normalMin: 0.5, normalMax: 1.1, optimalMin: 0.6, optimalMax: 1.0, label: "Typical female 0.5–1.1" },
  creatinineM: { scaleMin: 0.4, scaleMax: 1.6, normalMin: 0.7, normalMax: 1.3, optimalMin: 0.8, optimalMax: 1.1, label: "Typical male 0.7–1.3" },
  bun: { scaleMin: 5, scaleMax: 30, normalMin: 7, normalMax: 20, optimalMin: 10, optimalMax: 18, label: "Typical 7–20" },
  egfr: { scaleMin: 30, scaleMax: 120, normalMin: 60, normalMax: 120, optimalMin: 90, optimalMax: 120, label: "Typical ≥60 · optimal ≥90" },
  wbc: { scaleMin: 3, scaleMax: 15, normalMin: 4, normalMax: 11, optimalMin: 4.5, optimalMax: 9, label: "Typical 4–11" },
  hgbF: { scaleMin: 10, scaleMax: 18, normalMin: 12, normalMax: 16, optimalMin: 12.5, optimalMax: 15, label: "Typical female 12–16" },
  platelets: { scaleMin: 100, scaleMax: 500, normalMin: 150, normalMax: 450, optimalMin: 180, optimalMax: 350, label: "Typical 150–450" },
  b12: { scaleMin: 100, scaleMax: 1000, normalMin: 200, normalMax: 900, optimalMin: 400, optimalMax: 800, label: "Typical 200–900 · optimal 400–800" },
  uricMale: { scaleMin: 2, scaleMax: 12, normalMin: 3.5, normalMax: 7.2, optimalMin: 3.5, optimalMax: 6.0, label: "Typical male 3.5–7.2 · optimal 3.5–6.0" },
  psa: { scaleMin: 0, scaleMax: 4, normalMin: 0, normalMax: 4, optimalMin: 0, optimalMax: 1, label: "Typical <4.0 · lower is generally reassuring" },
  amylase: { scaleMin: 20, scaleMax: 140, normalMin: 30, normalMax: 110, optimalMin: 40, optimalMax: 90, label: "Typical 30–110" },
  lipase: { scaleMin: 0, scaleMax: 200, normalMin: 0, normalMax: 160, optimalMin: 10, optimalMax: 80, label: "Typical ≤160" },
};

// ── LAB FACTORY ───────────────────────────────────────────────────────────────
function lab(marker, value, unit, date, state, options = {}) {
  const def = getMarkerDefinition(marker);
  return {
    marker,
    value: String(value),
    unit,
    date,
    nextDue: options.nextDue || "",
    state,
    trend: options.trend || "stable",
    note: options.note || "Recorded lab result",
    previous: options.previous || "Not available",
    details: options.details || "Included in the full lab record. Meridian uses this as context unless it contributes to today's main signal.",
    contributesTo: options.contributesTo || "Full Lab Record",
    range: options.range,
    markerId: def.id,
    system: options.system || def.system,
    visibility: options.visibility || "active",
    eventContext: options.eventContext || "",
    category: options.category || def.system || "General",
  };
}

// ── ALL LAB DATA (unchanged from original) ───────────────────────────────────
const stephanieLabs = [
  // ── 2026 — Most recent ──────────────────────────────────────────
  lab("TSH", "3.03", "mIU/L", "2026-03-28", "Watch", {
    trend: "watch",
    previous: "4.36",
    nextDue: "2026-09-28",
    note: "Improving but still above your 1.69 personal baseline",
    contributesTo: "Thyroid Adaptation",
    range: ranges.tsh,
  }),
  lab("HbA1c", "5.11", "%", "2026-03-28", "Optimal", {
    trend: "stable",
    previous: "5.14",
    nextDue: "2027-03-28",
    note: "Stable within optimal range",
    range: ranges.hba1c,
  }),
  lab("Glucose", "87", "mg/dL", "2026-03-28", "Optimal", {
    nextDue: "2027-03-28",
    note: "Fasting glucose stable",
    range: ranges.glucose,
  }),
  lab("Vitamin D", "48", "ng/mL", "2026-03-28", "Optimal", {
    trend: "up",
    previous: "23.3",
    nextDue: "2026-09-28",
    note: "Recovered into optimal range",
    contributesTo: "Recovery Context",
    range: ranges.vitaminD,
  }),
  lab("Vitamin B12", "1081", "pg/mL", "2026-03-28", "Watch", {
    trend: "up",
    previous: "375",
    nextDue: "2026-06-28",
    note: "Above optimal range — review supplementation context before adjusting dose",
    range: ranges.b12,
  }),
  lab("HDL", "47.1", "mg/dL", "2026-03-28", "Watch", {
    trend: "up",
    previous: "33.45",
    nextDue: "2026-09-28",
    note: "Improving — target ≥55 mg/dL",
    range: ranges.hdl,
  }),
  lab("Triglycerides", "66.4", "mg/dL", "2026-03-28", "Optimal", {
    trend: "down",
    previous: "78.60",
    nextDue: "2027-03-28",
    note: "Stable in optimal range",
    range: ranges.tg,
  }),
  lab("LDL", "95", "mg/dL", "2026-03-28", "Optimal", {
    nextDue: "2027-03-28",
    note: "Within optimal range",
    range: ranges.ldl,
  }),
  lab("Total Cholesterol", "155", "mg/dL", "2026-03-28", "Optimal", {
    nextDue: "2027-03-28",
    note: "Within optimal range",
    range: ranges.totalChol,
  }),
  lab("eGFR", "84", "mL/min", "2026-03-28", "Optimal", {
    trend: "up",
    previous: "67",
    nextDue: "2026-09-28",
    note: "Recovered from prior dip",
    range: ranges.egfr,
  }),
  lab("Creatinine", "0.91", "mg/dL", "2026-03-28", "Optimal", {
    nextDue: "2026-09-28",
    range: ranges.creatinineF,
  }),
  lab("CBC", "Normal", "panel", "2026-03-28", "Optimal", {
    note: "All CBC values within reference range",
  }),

  // ── Historical active labs ───────────────────────────────────────

  // ── 2025 — Dec 16 ───────────────────────────────────────────────
  lab("TSH", "4.36", "mIU/L", "2025-12-16", "Watch", {
    note: "Elevated — only out-of-range value this panel",
    range: ranges.tsh,
  }),
  lab("HbA1c", "5.30", "%", "2025-12-16", "Optimal", {
    note: "Within normal range",
    range: ranges.hba1c,
  }),
  lab("Glucose", "89", "mg/dL", "2025-12-16", "Optimal", {
    note: "Fasting glucose stable",
    range: ranges.glucose,
  }),
  lab("Total Cholesterol", "121", "mg/dL", "2025-12-16", "Optimal", {
    note: "Healthy lipid profile",
    range: ranges.totalChol,
  }),
  lab("LDL", "64", "mg/dL", "2025-12-16", "Optimal", {
    note: "Within optimal range",
    range: ranges.ldl,
  }),
  lab("HDL", "40.8", "mg/dL", "2025-12-16", "Watch", {
    note: "Below optimal target — improving trend continues",
    range: ranges.hdl,
  }),
  lab("Triglycerides", "79.3", "mg/dL", "2025-12-16", "Optimal", {
    note: "Stable in optimal range",
    range: ranges.tg,
  }),
  lab("Creatinine", "1.11", "mg/dL", "2025-12-16", "Watch", {
    note: "Mildly elevated during abnormal urinalysis context; improved by 2026 follow-up",
    range: ranges.creatinineF,
  }),
  lab("eGFR", "67", "mL/min", "2025-12-16", "Watch", {
    note: "Mild decrease during abnormal urinalysis context; improved to 84 by 2026 follow-up",
    range: ranges.egfr,
  }),
  lab("Hemoglobin", "13.6", "g/dL", "2025-12-16", "Optimal", {
    note: "No anemia detected",
    range: ranges.hgbF,
  }),
  lab("CBC", "Normal", "panel", "2025-12-16", "Optimal", {
    note: "WBC, RBC, hematocrit, platelets, differential — all within reference",
  }),
  lab("Urinalysis", "Mild findings", "finding", "2025-12-16", "Watch", {
    note: "Protein 15 mg/dL, RBC 3–5, WBC 5–7, few bacteria — consistent with early UTI, confirmed 2026",
    eventContext: "Pre-UTI findings — resolved after treatment",
  }),

  // ── 2024 ────────────────────────────────────────────────────────
  // TSH — Aug 2024 elevated (triggered closer monitoring), Mar 2024 personal best
  lab("TSH", "4.36", "mIU/L", "2024-08-28", "Watch", {
    note: "Elevated — highest reading since 2023, triggered closer monitoring",
    range: ranges.tsh,
  }),
  lab("TSH", "1.69", "mIU/L", "2024-03-16", "Optimal", {
    note: "Personal best baseline — lowest recorded value",
    range: ranges.tsh,
  }),

  // HbA1c history
  lab("HbA1c", "5.14", "%", "2024-08-28", "Optimal", { note: "Stable glucose pattern", range: ranges.hba1c }),
  lab("HbA1c", "5.30", "%", "2024-03-16", "Optimal", { note: "Stable glucose pattern", range: ranges.hba1c }),

  // Lipids — March 2024 panel
  lab("HDL", "33.45", "mg/dL", "2024-03-16", "Watch", { note: "Below optimal target", range: ranges.hdl }),
  lab("Triglycerides", "78.60", "mg/dL", "2024-03-16", "Optimal", { note: "Within optimal range", range: ranges.tg }),
  lab("LDL", "77.96", "mg/dL", "2024-03-16", "Optimal", { note: "Within optimal range", range: ranges.ldl }),
  lab("Total Cholesterol", "127.13", "mg/dL", "2024-03-16", "Optimal", { note: "Within optimal range", range: ranges.totalChol }),

  // Metabolic — March 2024
  lab("Glucose", "81.5", "mg/dL", "2024-03-16", "Optimal", { note: "Fasting glucose stable", range: ranges.glucose }),
  lab("Creatinine", "0.85", "mg/dL", "2024-03-16", "Optimal", { note: "Within reference range", range: ranges.creatinineF }),
  lab("eGFR", "90", "mL/min", "2024-03-16", "Optimal", { note: "Normal kidney function", range: ranges.egfr }),

  // ── 2023 ────────────────────────────────────────────────────────
  lab("TSH", "2.88", "mIU/L", "2023-07-12", "Optimal", { note: "Within reference range", range: ranges.tsh }),
  lab("Free T3", "2.74", "pg/mL", "2023-07-12", "Optimal", { note: "Within reference range" }),
  lab("TPO Antibodies", "<10", "IU/mL", "2023-07-12", "Optimal", { note: "Negative — no autoimmune thyroid activity" }),
  lab("TSH", "4.41", "mIU/L", "2023-06-24", "Watch", { note: "Slightly above reference", range: ranges.tsh }),
  lab("TSH", "3.87", "mIU/L", "2023-01-17", "Optimal", { note: "Within reference range", range: ranges.tsh }),
  lab("HbA1c", "5.00", "%", "2023-06-24", "Optimal", { range: ranges.hba1c }),
  lab("HbA1c", "4.90", "%", "2023-01-17", "Optimal", { range: ranges.hba1c }),
  lab("HDL", "37", "mg/dL", "2023-06-24", "Watch", { range: ranges.hdl }),
  lab("HDL", "38", "mg/dL", "2023-01-17", "Watch", { range: ranges.hdl }),
  lab("Triglycerides", "146", "mg/dL", "2023-06-24", "Watch", { range: ranges.tg }),
  lab("Triglycerides", "79", "mg/dL", "2023-01-17", "Optimal", { range: ranges.tg }),
  lab("Vitamin D", "23.3", "ng/mL", "2023-07-12", "Watch", { note: "Historical low reserve", range: ranges.vitaminD }),
  lab("Insulin Fasting", "6.70", "mIU/L", "2023-07-12", "Optimal", { note: "Within reference range" }),
  lab("Cortisol AM", "16.70", "µg/dL", "2023-07-12", "Optimal"),
  lab("Folate", "14.60", "ng/mL", "2023-07-12", "Optimal"),

  // ── Archived event labs ──────────────────────────────────────────
  lab("Influenza A/B", "Negative", "rapid test", "2023-02-21", "Optimal", { visibility: "archived", eventContext: "Acute illness screening" }),
  lab("SARS-CoV-2 PCR", "Not detected", "PCR", "2023-02-21", "Optimal", { visibility: "archived", eventContext: "Acute illness screening" }),
  lab("BhCG Quantitative", "2.38", "mIU/mL", "2022-07-26", "Optimal", { note: "Non-pregnant range at that time", visibility: "archived", eventContext: "Pregnancy loss follow-up" }),
  lab("BhCG Quantitative", "116.06", "mIU/mL", "2022-07-11", "Watch", { visibility: "archived", eventContext: "Pregnancy loss follow-up" }),
  lab("BhCG Quantitative", "585.32", "mIU/mL", "2022-06-23", "Watch", { visibility: "archived", eventContext: "Pregnancy loss follow-up" }),
  lab("Progesterone", "1.10", "ng/mL", "2022-06-20", "Watch", { visibility: "archived", eventContext: "Pregnancy loss follow-up" }),
  lab("Blood Type", "O", "type", "2022-06-14", "Optimal", { visibility: "archived", eventContext: "Reference record" }),
];

const aixaLabs = [
  lab("AST", "97", "U/L", "2026-04-15", "Attention", { nextDue: "2026-06-10", trend: "up", previous: "41 U/L", note: "Increased on follow-up", contributesTo: "Metabolic Stress Signal", range: ranges.ast }),
  lab("ALT", "80", "U/L", "2026-04-15", "Attention", { nextDue: "2026-06-10", trend: "up", previous: "44 U/L", note: "Increased on follow-up", contributesTo: "Metabolic Stress Signal", range: ranges.alt }),
  lab("HbA1c", "5.77", "%", "2026-03-28", "Attention", { nextDue: "2026-06-28", trend: "watch", note: "Metabolic pattern to monitor", contributesTo: "Metabolic Stress Signal", range: ranges.hba1c }),
  lab("Glucose", "105", "mg/dL", "2026-03-28", "Watch", { nextDue: "2026-06-28", trend: "watch", note: "Higher fasting trend", contributesTo: "Metabolic Stress Signal", range: ranges.glucose }),
  lab("Vitamin D", "22.1", "ng/mL", "2026-03-28", "Watch", { nextDue: "2026-06-28", note: "Low reserve", contributesTo: "Recovery Context", range: ranges.vitaminD }),
  lab("Total Cholesterol", "167", "mg/dL", "2026-03-28", "Optimal", { nextDue: "2026-06-28", range: ranges.totalChol }),
  lab("Triglycerides", "95", "mg/dL", "2026-03-28", "Optimal", { nextDue: "2026-06-28", range: ranges.tg }),
  lab("HDL", "43", "mg/dL", "2026-03-28", "Watch", { nextDue: "2026-06-28", note: "Could be stronger", range: ranges.hdl }),
  lab("LDL", "105", "mg/dL", "2026-03-28", "Watch", { nextDue: "2026-06-28", range: ranges.ldl }),
  lab("Bilirubin Total", "1.27", "mg/dL", "2026-03-28", "Watch", { nextDue: "2026-06-28", note: "Mildly elevated context marker" }),
  lab("Alkaline Phosphatase", "90", "U/L", "2026-03-28", "Optimal"),
  lab("Creatinine", "0.76", "mg/dL", "2026-03-28", "Optimal", { range: ranges.creatinineF }),
  lab("BUN", "16", "mg/dL", "2026-03-28", "Optimal", { range: ranges.bun }),
  lab("eGFR", "89", "mL/min", "2026-03-28", "Optimal", { range: ranges.egfr }),
  lab("WBC", "10.46", "K/uL", "2026-03-28", "Watch", { range: ranges.wbc }),
  lab("Hemoglobin", "14.8", "g/dL", "2026-03-28", "Optimal", { range: ranges.hgbF }),
  lab("Platelets", "249", "K/uL", "2026-03-28", "Optimal", { range: ranges.platelets }),
  lab("Vitamin B12", "526", "pg/mL", "2026-03-28", "Optimal", { range: ranges.b12 }),
  lab("Urinalysis", "Positive markers", "finding", "2026-03-28", "Watch", { nextDue: "2026-03-31", note: "Nitrites, leukocytes and bacteria present" }),
  lab("Urine Culture", "No growth", "48 hr", "2026-03-31", "Optimal", { previous: "Positive urinalysis markers", note: "No bacterial growth after 48 hours" }),
  lab("Amylase", "67", "U/L", "2026-04-15", "Optimal", { range: ranges.amylase }),
  lab("Lipase", "136", "U/L", "2026-04-15", "Watch", { range: ranges.lipase }),
  lab("Ultrasound", "Enlarged liver", "finding", "2026-04-15", "Attention", { note: "Context marker, not used alone", contributesTo: "Metabolic Stress Signal" }),
];

const hectorLabs = [
  lab("Total Cholesterol", "216", "mg/dL", "2026-01-08", "Attention", { nextDue: "2026-04-08", note: "Above optimal", contributesTo: "Metabolic Load Building", range: ranges.totalChol }),
  lab("LDL", "135.6", "mg/dL", "2026-01-08", "Attention", { nextDue: "2026-04-08", note: "Primary lipid signal", contributesTo: "Metabolic Load Building", range: ranges.ldl }),
  lab("Triglycerides", "187", "mg/dL", "2026-01-08", "Attention", { nextDue: "2026-04-08", note: "Above optimal", contributesTo: "Metabolic Load Building", range: ranges.tg }),
  lab("HDL", "43", "mg/dL", "2026-01-08", "Watch", { nextDue: "2026-04-08", note: "Could be stronger", contributesTo: "Metabolic Context", range: ranges.hdl }),
  lab("Chol/HDL Ratio", "5.02", "ratio", "2026-01-08", "Watch", { nextDue: "2026-04-08", note: "Slightly above ideal" }),
  lab("Uric Acid", "9.80", "mg/dL", "2026-01-08", "Attention", { nextDue: "2026-04-08", note: "High follow-up marker", contributesTo: "Follow-up Marker", range: ranges.uricMale }),
  lab("HbA1c", "5.8", "%", "2026-01-08", "Watch", { nextDue: "2026-04-08", note: "Borderline glucose regulation signal", contributesTo: "Metabolic Load Building", range: ranges.hba1c }),
  lab("TSH", "2.676", "mIU/L", "2026-01-08", "Optimal", { nextDue: "2027-01-08", note: "Thyroid marker normal", range: ranges.tsh }),
  lab("PSA", "0.86", "ng/mL", "2026-01-08", "Optimal", { nextDue: "2027-01-08", note: "Reassuring male health marker", range: ranges.psa }),
  lab("AST", "Normal", "U/L", "2026-01-08", "Optimal", { note: "Liver marker reported normal" }),
  lab("ALT", "Normal", "U/L", "2026-01-08", "Optimal", { note: "Liver marker reported normal" }),
  lab("ALP", "Normal", "U/L", "2026-01-08", "Optimal", { note: "Liver marker reported normal" }),
  lab("GGT", "Normal", "U/L", "2026-01-08", "Optimal", { note: "Liver marker reported normal" }),
  lab("CBC", "Normal", "panel", "2026-01-08", "Optimal", { note: "RBC, WBC, hemoglobin and platelets reported normal" }),
  lab("Urinalysis", "Normal", "panel", "2026-01-08", "Optimal", { note: "No infection, protein, or blood reported" }),
  lab("Amylase", "Normal", "U/L", "2026-01-08", "Optimal", { note: "Pancreas marker reported normal" }),
  lab("Calcitonin", "Normal", "test", "2026-01-08", "Optimal", { note: "Reported normal" }),
];

// ── DEMO USERS (unchanged from original) ─────────────────────────────────────
const demoUsers = {
  stephanie: {
    id: "stephanie",
    name: "Stephanie",
    role: "Active Optimization",
    biologicalProfile: "Female biology",
    hormonalContext: "Active cycle",
    userProfile: "Active Optimization",
    toneMode: "Mechanistic",
    severity: "Watch",
    activityLevel: "Moderate",
    labRecency: "Full historical record · 2022–2026",
    severityColor: DS.amber,
    headline: "Recovery stable — thyroid still adapting",
    status: "Your system has recovered from a prior stress phase, but thyroid regulation has not fully returned to your personal baseline.",
    cause: "Your 2026 labs show strong recovery across glucose, kidney function, lipids, and vitamin D after a more disrupted 2025 pattern.",
    emphasis: "The remaining signal is thyroid regulation: TSH improved, but is still above your personal 2024 baseline.",
    actions: [
      "Stabilize thyroid recovery through consistency",
      "Keep sleep and wake timing steady this week",
      "Avoid stacking intense training on high-stress days",
    ],
    trust: "Derived from longitudinal labs 2023–2026 + Garmin/Oura context · Meridian interprets, you decide",
    connectedInsight: {
      signals: [
        { label: "TSH", direction: "↓", source: "Labs", meaning: "Improved from 4.36 to 3.03, but above your 1.69 baseline" },
        { label: "HbA1c", direction: "↓", source: "Labs", meaning: "Improved from 5.30 to 5.11" },
        { label: "eGFR", direction: "↑", source: "Labs", meaning: "Recovered from 67 to 84" },
      ],
      conclusion: "Most systems have normalized. Thyroid regulation is the last remaining adaptive signal — Meridian is prioritizing consistency over intensity.",
    },
    labs: stephanieLabs,
  },
  aixa: {
    id: "aixa",
    name: "Aixa",
    role: "Condition Management",
    biologicalProfile: "Female biology",
    hormonalContext: "No active cycle",
    userProfile: "Condition Management",
    toneMode: "Careful",
    severity: "Attention",
    activityLevel: "Limited / variable",
    labRecency: "Recent follow-up",
    severityColor: DS.red,
    headline: "Metabolic stress signal active",
    status: "Your body is under increased metabolic and liver-related stress.",
    cause: "Your glucose levels and liver markers suggest your body is working harder to regulate energy over time.",
    emphasis: "This can help explain variable energy and slower recovery.",
    actions: [
      "Keep daily movement consistent with short walks after meals",
      "Focus on simple, repeatable nutrition habits this week",
      "Prioritize rest on lower-energy days instead of pushing through",
    ],
    trust: "Derived from Glucose + HbA1c + AST/ALT · Meridian interprets, you decide",
    connectedInsight: {
      signals: [
        { label: "Glucose", direction: "↑", source: "Labs", meaning: "Fasting glucose is above ideal" },
        { label: "HbA1c", direction: "↑", source: "Labs", meaning: "Energy regulation needs closer tracking" },
        { label: "AST/ALT", direction: "↑", source: "Labs", meaning: "Liver markers increased on follow-up" },
      ],
      conclusion: "These signals point to a metabolic pattern that can explain variable energy and slower recovery.",
    },
    labs: aixaLabs,
  },
  hector: {
    id: "hector",
    name: "Hector",
    role: "General Wellness",
    biologicalProfile: "Male biology",
    hormonalContext: "Not applicable",
    userProfile: "General Wellness",
    toneMode: "Direct",
    severity: "Watch",
    activityLevel: "Sedentary",
    labRecency: "Jan 8, 2026",
    severityColor: DS.amber,
    headline: "Metabolic load building",
    status: "Your body is starting to show early signs of metabolic strain.",
    cause: "Your cholesterol, triglycerides, and blood sugar markers are above optimal ranges.",
    emphasis: "Combined with low daily movement, this suggests your body is working harder to manage energy balance.",
    actions: [
      "Add 15–20 minutes of daily walking as a baseline habit",
      "Reduce sugar and refined carbohydrates this week",
      "Increase hydration consistently throughout the day",
    ],
    trust: "Derived from Lipids + HbA1c (Jan 2026) + Activity · Meridian interprets, you decide",
    connectedInsight: {
      signals: [
        { label: "LDL", direction: "↑", source: "Labs", meaning: "Cholesterol is above optimal" },
        { label: "Triglycerides", direction: "↑", source: "Labs", meaning: "Energy storage markers are elevated" },
        { label: "Movement", direction: "↓", source: "Lifestyle", meaning: "Daily activity is below baseline needs" },
      ],
      conclusion: "Together, these signals suggest metabolic load is building before it becomes harder to reverse.",
    },
    labs: hectorLabs,
  },
  demo: {
    id: "demo",
    name: "Maya",
    role: "New User",
    biologicalProfile: "Female biology",
    hormonalContext: "Active cycle",
    userProfile: "Primer Paso",
    toneMode: "Educational",
    severity: "Watch",
    activityLevel: "Light",
    labRecency: "Wearable connected · No labs yet",
    severityColor: DS.teal,
    headline: "Getting to know your baseline",
    status: "Meridian is analyzing your wearable history.",
    cause: "No labs uploaded yet.",
    emphasis: "Upload your labs to unlock full intelligence.",
    actions: [
      "Upload your lab PDF to unlock your first insight",
      "Connect your wearable if not already synced",
      "Check back tomorrow for your first pattern observation",
    ],
    trust: "Derived from wearable history · Meridian interprets, you decide",
    connectedInsight: {
      signals: [
        { label: "HRV", direction: "→", source: "Wearable", meaning: "Baseline being established" },
        { label: "RHR", direction: "→", source: "Wearable", meaning: "Pattern analysis in progress" },
        { label: "Sleep", direction: "→", source: "Wearable", meaning: "First 7 days calibrating" },
      ],
      conclusion: "Meridian needs 7 days of wearable data and at least one lab panel to generate your first insight.",
    },
    labs: [],
  },
  alex: {
    id: "alex",
    name: "Alex",
    role: "Wearable Only",
    biologicalProfile: "Female biology",
    hormonalContext: "Active cycle",
    userProfile: "Optimización Activa",
    toneMode: "Mechanistic",
    severity: "Watch",
    activityLevel: "Moderate",
    labRecency: "Wearable only · Labs pending",
    severityColor: DS.amber,
    headline: "Pattern detected — cause unknown",
    status: "Your deep sleep has dropped below your personal baseline.",
    cause: "Wearable shows a consistent pattern over 6 days.",
    emphasis: "Labs needed to confirm the root cause.",
    actions: [
      "Upload your lab PDF to confirm the root cause",
      "Track your sleep timing this week",
      "Avoid caffeine after 2pm while pattern is active",
    ],
    trust: "Derived from wearable patterns · Meridian interprets, you decide",
    connectedInsight: {
      signals: [
        { label: "Deep Sleep", direction: "↓", source: "Wearable", meaning: "15% below your 30-day baseline" },
        { label: "HRV", direction: "↓", source: "Wearable", meaning: "Subtle downward trend this week" },
        { label: "Labs", direction: "?", source: "Missing", meaning: "Root cause unconfirmed without labs" },
      ],
      conclusion: "Meridian suspects Magnesium or glucose instability at night. Your labs will confirm which one.",
    },
    labs: [],
  },
};

// ── STATUS STYLING ────────────────────────────────────────────────────────────
function statusStyle(state) {
  if (state === "Optimal") return { color: DS.green, bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.20)" };
  if (state === "Watch") return { color: DS.amber, bg: "rgba(252,211,77,0.08)", border: "rgba(252,211,77,0.20)" };
  return { color: DS.red, bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.20)" };
}

function getTrendContext(trend, state) {
  if (trend === "up" && state === "Watch")      return "moving toward optimal";
  if (trend === "up" && state === "Optimal")    return "holding above optimal";
  if (trend === "up" && state === "Attention")  return "still needs attention";
  if (trend === "down" && state === "Optimal")  return "moving toward optimal";
  if (trend === "down" && state === "Watch")    return "declining — monitor closely";
  if (trend === "down" && state === "Attention") return "declining — follow up needed";
  if (trend === "watch")                        return "pattern not yet clear";
  if (trend === "stable" && state === "Optimal") return "holding steady";
  if (trend === "stable" && state === "Watch")  return "no change yet";
  return "";
}

function trendLabel(trend) {
  if (trend === "up") return { label: "↑ Improving", color: DS.green };
  if (trend === "down") return { label: "↓ Declining", color: DS.red };
  if (trend === "watch") return { label: "→ Watch", color: DS.amber };
  return { label: "→ Stable", color: DS.textMuted };
}

// ── RANGE VISUAL (polished) ───────────────────────────────────────────────────
function RangeVisual({ lab: labItem }) {
  const range = labItem.range;
  const numeric = parseNumericValue(labItem.value);

  if (!range || numeric === null) {
    return (
      <div style={{
        marginTop: "16px",
        borderRadius: "12px",
        border: `1px solid ${DS.border}`,
        background: "rgba(255,255,255,0.02)",
        padding: "12px",
        fontSize: "12px",
        color: DS.textMuted,
      }}>
        No numeric range available for this marker.
      </div>
    );
  }

  const youPosition = getRangePercent(labItem.value, range);
  const normalStart = getBandPercent(range.normalMin, range);
  const normalEnd = getBandPercent(range.normalMax, range);

  return (
    <div style={{ marginTop: "20px" }}>

      {/* Scale min/max — top corners only */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "10px", color: DS.textMuted }}>
        <span>{range.scaleMin}</span>
        <span>{range.scaleMax}</span>
      </div>

      {/* Bar track — gradient */}
      <div style={{ position: "relative", height: "12px", borderRadius: "6px", overflow: "visible" }}>

        {/* Gradient background */}
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "6px",
          background: `linear-gradient(to right,
            rgba(248,113,113,0.80) 0%,
            rgba(252,211,77,0.75) ${normalStart}%,
            rgba(74,222,128,0.75) ${(normalStart + normalEnd) / 2}%,
            rgba(252,211,77,0.75) ${normalEnd}%,
            rgba(248,113,113,0.80) 100%
          )`,
        }} />

        {/* Pin only — no label above the bar */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: youPosition + "%",
          transform: "translate(-50%, -50%)",
          width: "18px", height: "18px",
          borderRadius: "50%",
          background: "#FFFFFF",
          border: `2.5px solid ${DS.bg}`,
          boxShadow: "0 0 0 2px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.5)",
          zIndex: 4,
        }} />
      </div>

      {/* Below bar: Low | You: value · range label | High */}
      <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(248,113,113,0.80)" }}>
          Low
        </span>
        <span style={{
          fontSize: "10px", fontWeight: 700,
          color: DS.text,
          background: DS.bg,
          border: `1px solid ${DS.border}`,
          borderRadius: "999px",
          padding: "2px 8px",
          whiteSpace: "normal",
          textAlign: "center",
          maxWidth: "calc(100% - 60px)",
          overflow: "hidden",
        }}>
          <span style={{ color: DS.textSoft }}>
            {range.label}
          </span>
        </span>
        <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(248,113,113,0.80)", textAlign: "right" }}>
          High
        </span>
      </div>

      {/* Range explanation */}
      <div style={{ marginTop: "8px", fontSize: "11px", color: DS.textMuted }}>
        {getRangeExplanation(labItem.value, range)}
      </div>
    </div>
  );
}

// ── RANGE EXPLANATION ─────────────────────────────────────────────────────────
function getRangeExplanation(value, range) {
  const v = parseNumericValue(value);
  if (v === null || !range) return "";
  if (v >= range.optimalMin && v <= range.optimalMax) return "Within optimal range — this supports stable function";
  if (v >= range.normalMin && v <= range.normalMax) return "Within normal range, but not fully optimized";
  if (v < range.normalMin) return "Below normal range — may indicate insufficient levels";
  return "Above normal range — may indicate excess or stress";
}

// ── GLASS CARD STYLE ──────────────────────────────────────────────────────────
const glassCard = {
  background: DS.card,
  border: `1px solid ${DS.border}`,
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderRadius: "20px",
  transition: "border-color 0.22s ease, background 0.22s ease",
};

// ── UPLOAD LABS BLOCK ─────────────────────────────────────────────────────────
function UploadLabsBlock({ onStartReview }) {
  return (
    <div style={{ ...glassCard, padding: "18px", marginBottom: "22px", display: "grid", gap: "12px" }}>
      <button
        type="button"
        onClick={onStartReview}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: "16px",
          border: `1px solid ${DS.border2}`,
          background: `linear-gradient(135deg, rgba(45,212,191,0.16), rgba(103,232,249,0.08))`,
          color: DS.text, fontSize: "15px", fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          boxShadow: "0 0 24px rgba(45,212,191,0.10)",
        }}
      >
        <Icon name="flask" size={16} color={DS.cyan} />
        Upload lab PDF
      </button>
      <div style={{
        borderRadius: "14px", border: `1px solid ${DS.border}`,
        background: "rgba(255,255,255,0.025)", padding: "13px 15px",
        display: "flex", gap: "10px", alignItems: "flex-start",
      }}>
        <span style={{ color: DS.teal, fontWeight: 900, fontSize: "14px", lineHeight: 1.2 }}>✦</span>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: DS.text, marginBottom: "4px" }}>
            AI extraction requires review before saving
          </div>
          <div style={{ fontSize: "12px", color: DS.textMuted, lineHeight: 1.55 }}>
            Meridian extracts biomarkers from your PDF, but you must confirm the values before they affect your insights.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LAB REVIEW MODAL ──────────────────────────────────────────────────────────
function LabReviewModal({ onClose, onConfirm }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,14,16,0.85)", backdropFilter: "blur(12px)" }} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        style={{
          position: "relative", width: "100%", maxWidth: "620px", maxHeight: "90vh",
          margin: "0 auto", overflowY: "auto",
          background: "rgba(4,14,16,0.98)", border: `1px solid ${DS.border}`,
          borderRadius: "28px 28px 0 0", borderBottom: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: DS.border }} />
        </div>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${DS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.teal, marginBottom: "8px" }}>
                AI extraction staging area
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", fontWeight: 700, color: DS.text, letterSpacing: "-0.04em" }}>
                Review extracted results
              </div>
              <div style={{ marginTop: "6px", fontSize: "13px", color: DS.textSoft, lineHeight: 1.55 }}>
                These values are not saved yet. Confirm them before Meridian updates your insights.
              </div>
            </div>
            <button onClick={onClose} style={{ width: "40px", height: "40px", borderRadius: "14px", border: `1px solid ${DS.border}`, background: "rgba(255,255,255,0.05)", color: DS.textSoft, fontSize: "18px", cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "20px 24px 28px", display: "grid", gap: "14px" }}>
          <div style={{ ...glassCard, padding: "15px", borderLeft: `3px solid ${DS.teal}` }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "6px" }}>Preview of impact</div>
            <div style={{ fontSize: "14px", color: DS.text, lineHeight: 1.6 }}>
              If confirmed, Meridian will keep the primary Home signal as <strong>Recovery stable — thyroid still adapting</strong>, while using the new values as validated evidence.
            </div>
          </div>
          {mockExtractedLabs.map((item) => {
            const ss = statusStyle(item.statusPreview);
            return (
              <div key={item.marker} style={{ ...glassCard, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: DS.text, marginBottom: "6px" }}>{item.marker}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "32px", fontWeight: 700, color: DS.text, lineHeight: 1 }}>
                      {item.detectedValue}<span style={{ fontSize: "13px", color: DS.textSoft, marginLeft: "6px" }}>{item.unit}</span>
                    </div>
                  </div>
                  <span style={{ borderRadius: "999px", border: `1px solid ${ss.border}`, background: ss.bg, padding: "5px 11px", fontSize: "10px", fontWeight: 800, color: ss.color }}>{item.statusPreview}</span>
                </div>
                <div style={{ marginTop: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.025)", border: `1px solid ${DS.border}`, padding: "12px", fontSize: "12px", color: DS.textSoft, lineHeight: 1.55 }}>{item.impact}</div>
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "6px" }}>
            <button onClick={onClose} style={{ padding: "14px 16px", borderRadius: "14px", border: `1px solid ${DS.border}`, background: "rgba(255,255,255,0.035)", color: DS.textSoft, fontSize: "13px", fontWeight: 800, cursor: "pointer" }}>Cancel</button>
            <button onClick={onConfirm} style={{ padding: "14px 16px", borderRadius: "14px", border: "none", background: `linear-gradient(135deg, ${DS.teal}, ${DS.cyan})`, color: DS.bg, fontSize: "13px", fontWeight: 900, cursor: "pointer" }}>Confirm & save</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── INTELLIGENCE BLOCK — 4 STATES ────────────────────────────────────────────

function StateBlock({ color, children }) {
  return (
    <div style={{
      ...glassCard,
      borderRadius: "24px",
      overflow: "hidden",
      borderLeft: `4px solid ${color}`,
    }}>
      {children}
    </div>
  );
}

function ActionButton({ label, onClick, secondary = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: secondary ? "14px 20px" : "18px 24px",
        borderRadius: "16px",
        border: secondary ? `1px solid ${DS.border2}` : "none",
        background: secondary
          ? "rgba(45,212,191,0.08)"
          : `linear-gradient(135deg, ${DS.teal}, ${DS.cyan})`,
        color: secondary ? DS.teal : DS.bg,
        fontSize: secondary ? "14px" : "16px",
        fontWeight: 800,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        boxShadow: secondary ? "none" : "0 0 28px rgba(45,212,191,0.20)",
        transition: "all 0.22s cubic-bezier(.22,1,.36,1)",
      }}
      onMouseOver={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        if (!secondary) e.currentTarget.style.boxShadow = "0 0 44px rgba(45,212,191,0.35)";
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = "translateY(0)";
        if (!secondary) e.currentTarget.style.boxShadow = "0 0 28px rgba(45,212,191,0.20)";
      }}
    >
      {label}
    </button>
  );
}

// State 1 — INFERRING: wearable just connected, analyzing history
function StateInferring({ user, onGoToLabs }) {
  return (
    <StateBlock color={DS.teal}>
      <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: DS.teal, boxShadow: `0 0 10px ${DS.teal}`, animation: "ping 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.teal }}>
            Analyzing your history
          </span>
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, color: DS.text, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: "12px" }}>
          Meridian is reading your last 12 months
        </h2>
        <p style={{ fontSize: "15px", color: DS.textSoft, lineHeight: 1.65 }}>
          In the last 90 days, your resting heart rate has been trending upward while your activity stayed consistent. That pattern is worth understanding.
        </p>
      </div>
      <div style={{ padding: "20px 24px" }}>
        <p style={{ fontSize: "14px", color: DS.textMuted, lineHeight: 1.6, marginBottom: "16px" }}>
          Meridian can see the direction — but not the cause. Your labs will confirm whether this is metabolic, thyroid, or recovery-related.
        </p>
        <ActionButton label="Upload your labs to unlock the cause →" onClick={onGoToLabs} />
        <div style={{ marginTop: "10px", fontSize: "11px", color: DS.textMuted, textAlign: "center" }}>
          Derived from wearable history · Meridian interprets, you decide.
        </div>
      </div>
    </StateBlock>
  );
}

// State 2 — HYPOTHESIS: wearable only, days 1–6
function StateHypothesis({ user, onGoToLabs }) {
  return (
    <StateBlock color={DS.amber}>
      <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.amber }}>
            Hypothesis detected
          </span>
          <span style={{ fontSize: "10px", color: DS.textMuted }}>· 50% of data available</span>
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, color: DS.text, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: "12px" }}>
          Your sleep deep phase is below your own baseline
        </h2>
        <p style={{ fontSize: "15px", color: DS.textSoft, lineHeight: 1.65 }}>
          This could be Magnesium. It could be glucose instability at night. Without your labs, Meridian can point the direction — not confirm the cause.
        </p>
      </div>
      <div style={{ padding: "20px 24px" }}>
        <div style={{
          borderRadius: "14px", border: `1px solid rgba(252,211,77,0.20)`,
          background: "rgba(252,211,77,0.05)", padding: "14px 16px", marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: DS.amber, marginBottom: "6px" }}>What Meridian suspects</div>
          <div style={{ fontSize: "13px", color: DS.textSoft, lineHeight: 1.6 }}>
            Magnesium deficiency or late-night glucose spike — both suppress deep sleep. Your labs will confirm which one.
          </div>
        </div>
        <ActionButton label="Upload PDF to confirm the root cause →" onClick={onGoToLabs} />
        <div style={{ marginTop: "10px", fontSize: "11px", color: DS.textMuted, textAlign: "center" }}>
          Derived from wearable patterns · Meridian interprets, you decide.
        </div>
      </div>
    </StateBlock>
  );
}

// State 3 — CALIBRATING: baseline established, no labs yet
function StateCalibrating({ user, onGoToLabs }) {
  return (
    <StateBlock color={DS.cyan}>
      <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.cyan }}>
            Baseline established
          </span>
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, color: DS.text, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: "12px" }}>
          Meridian knows your normal — now needs your truth
        </h2>
        <p style={{ fontSize: "15px", color: DS.textSoft, lineHeight: 1.65 }}>
          Your HRV baseline is {user.name === "Stephanie" ? "24ms" : "established"}. Today at {user.name === "Stephanie" ? "19ms" : "below baseline"} — that's a real deviation, not noise.
        </p>
      </div>
      <div style={{ padding: "20px 24px" }}>
        <p style={{ fontSize: "14px", color: DS.textMuted, lineHeight: 1.6, marginBottom: "16px" }}>
          Meridian can tell something is off. But it can't tell you why without your labs. Sync them now to get your first full intelligence report.
        </p>
        <ActionButton label="Sync labs for full intelligence →" onClick={onGoToLabs} />
        <div style={{ marginTop: "10px", fontSize: "11px", color: DS.textMuted, textAlign: "center" }}>
          Derived from 7-day baseline · Meridian interprets, you decide.
        </div>
      </div>
    </StateBlock>
  );
}

// State 4 — SOLVED: full data, golden insight active
function StateSolved({ user, dominantSignal }) {
  return <InsightCard user={user} dominantSignal={dominantSignal} />;
}

// ── ROUTER: decides which state to show ──────────────────────────────────────
function SupportingContextSeparator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.35 }}
      style={{
        margin: "28px 0 20px",
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: DS.textMuted,
          whiteSpace: "nowrap",
        }}>
          Supporting context
        </div>
        <div style={{ height: "1px", flex: 1, background: DS.border }} />
      </div>
      <div style={{ fontSize: "11px", color: DS.textMuted }}>
        Secondary signals — not your priority today
      </div>
    </motion.div>
  );
}

// ── INTELLIGENCE BLOCK ROUTER ─────────────────────────────────────────────────
function IntelligenceBlockRouter({ user, dominantSignal, onGoToLabs }) {
  // In Phase 1 demo, determine state from user profile
  // In Phase 2 this will come from real data availability flags
  const getState = () => {
    if (user.id === "demo")      return "INFERRING";
    if (user.id === "alex")      return "HYPOTHESIS";
    if (user.id === "stephanie") return "SOLVED";
    if (user.id === "aixa")      return "SOLVED";
    if (user.id === "hector")    return "CALIBRATING";
    return "INFERRING";
  };

  const state = getState();

  if (state === "INFERRING")   return <StateInferring   user={user} onGoToLabs={onGoToLabs} />;
  if (state === "HYPOTHESIS")  return <StateHypothesis  user={user} onGoToLabs={onGoToLabs} />;
  if (state === "CALIBRATING") return <StateCalibrating user={user} onGoToLabs={onGoToLabs} />;
  return <StateSolved user={user} dominantSignal={dominantSignal} />;
}

// ── INSIGHT CARD ──────────────────────────────────────────────────────────────
function InsightCard({ user, dominantSignal }) {
  const sev = statusStyle(user.severity === "Attention" ? "Attention" : user.severity === "Watch" ? "Watch" : "Optimal");
  const primaryAction = generateDominantAction(user, dominantSignal);

  return (
    <div style={{ ...glassCard, borderRadius: "28px", overflow: "hidden" }}>

      {/* Hero block */}
      <div style={{ padding: "28px 28px 24px", borderBottom: `1px solid ${DS.border}` }}>
        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          <span style={{
            borderRadius: "999px",
            border: `1px solid ${sev.border}`,
            background: sev.bg,
            padding: "4px 12px",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: sev.color,
          }}>{user.severity}</span>
          <span style={{
            borderRadius: "999px",
            border: `1px solid ${DS.border}`,
            background: "rgba(255,255,255,0.03)",
            padding: "4px 12px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: DS.textMuted,
          }}>{user.toneMode} insight</span>
        </div>

        {/* Headline — Fraunces, not screaming */}
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "clamp(26px, 4vw, 40px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1.1,
          color: DS.text,
          marginBottom: "12px",
        }}>
          {user.headline}
        </h1>

        <p style={{ fontSize: "16px", fontWeight: 500, color: DS.textSoft, lineHeight: 1.65 }}>
          {user.status}
        </p>
      </div>

      {/* Cause block */}
      <div style={{ padding: "22px 28px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.11em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "10px" }}>
          What's happening
        </div>
        <p style={{ fontSize: "15px", lineHeight: 1.7, color: DS.textSoft }}>
          {user.cause}{" "}
          <strong style={{ color: DS.text }}>{user.emphasis}</strong>
        </p>
      </div>

      {/* Connected Intelligence */}
      <div style={{ padding: "22px 28px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.11em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "14px" }}>
          Connected signals
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          {user.connectedInsight.signals.map((signal) => (
            <div key={signal.label} style={{
              flex: "1 1 140px",
              borderRadius: "14px",
              border: `1px solid ${DS.border}`,
              background: "rgba(255,255,255,0.03)",
              padding: "14px",
            }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: DS.text, fontFamily: "'Fraunces', serif" }}>
                {signal.direction} {signal.label}
              </div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.textMuted, margin: "4px 0" }}>
                {signal.source}
              </div>
              <div style={{ fontSize: "12px", color: DS.textSoft, lineHeight: 1.5 }}>{signal.meaning}</div>
            </div>
          ))}
        </div>
        <div style={{
          borderRadius: "14px",
          border: `1px solid rgba(45,212,191,0.18)`,
          background: "rgba(45,212,191,0.06)",
          padding: "14px 16px",
          fontSize: "14px",
          color: DS.text,
          lineHeight: 1.65,
          borderLeft: `3px solid ${DS.teal}`,
        }}>
          {user.connectedInsight.conclusion}
        </div>
      </div>

      {/* Action block */}
      <div style={{ padding: "22px 28px", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.11em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "14px" }}>
          Your priority today
        </div>
        {/* One Dominant Action */}
        <button style={{
          width: "100%", padding: "18px 24px", borderRadius: "16px", border: "none",
          background: `linear-gradient(135deg, ${DS.teal}, ${DS.cyan})`,
          color: DS.bg, fontSize: "16px", fontWeight: 800, cursor: "pointer",
          marginBottom: "12px", letterSpacing: "-0.01em",
          boxShadow: "0 0 28px rgba(45,212,191,0.20)",
          transition: "box-shadow 0.22s ease, transform 0.22s ease",
        }}
          onMouseOver={e => { e.currentTarget.style.boxShadow = "0 0 44px rgba(45,212,191,0.35)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseOut={e => { e.currentTarget.style.boxShadow = "0 0 28px rgba(45,212,191,0.20)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {primaryAction}
        </button>
        {/* Supporting actions */}
        <div style={{ borderRadius: "14px", border: `1px solid ${DS.border}`, background: "rgba(255,255,255,0.02)", padding: "14px 16px" }}>
          {getVisibleSupportingActions(user.actions).map((action, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0",
              borderBottom: i < getVisibleSupportingActions(user.actions).length - 1 ? `1px solid ${DS.border}` : "none",
            }}>
              <span style={{ color: DS.teal, fontWeight: 700, flexShrink: 0, fontSize: "13px" }}>{i + 2}.</span>
              <span style={{ fontSize: "14px", color: DS.textSoft, lineHeight: 1.5 }}>{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trust + disclaimer */}
      <div style={{ padding: "16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: DS.textMuted }}>
          <Icon name="activity" size={11} color={DS.textMuted} />
          {normalizeTrustLine(user.trust)}
        </div>
        <div style={{ marginTop: "6px", fontSize: "10px", color: "rgba(95,142,133,0.7)" }}>
          Meridian provides wellness intelligence, not medical diagnosis.
        </div>
      </div>
    </div>
  );
}

// ── LAB DETAIL MODAL ─────────────────────────────────────────────────────────
function LabDetailModal({ lab: labItem, onClose, allLabs = [] }) {
  if (!labItem) return null;
  const ss = statusStyle(labItem.state);
  const trend = trendLabel(labItem.trend);
  const { formattedDate, formattedNext, overdue, dueSoon, daysUntilDue } = getLabStatusDates(labItem);
  const [showHistory, setShowHistory] = useState(false);

  // Build historical results for this marker from allLabs
  const history = allLabs
    .filter(l => l.marker === labItem.marker && l.visibility !== "archived")
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first

  const hasHistory = history.length > 1;

  // Close on backdrop click or Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", alignItems: "flex-end",
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(4,14,16,0.85)",
          backdropFilter: "blur(12px)",
        }}
      />

      {/* Modal sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          margin: "0 auto",
          overflowY: "auto",
          background: "rgba(4,14,16,0.98)",
          border: `1px solid ${DS.border}`,
          borderRadius: "28px 28px 0 0",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: DS.border }} />
        </div>

        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 24px 16px",
          background: "rgba(4,14,16,0.96)",
          borderBottom: `1px solid ${DS.border}`,
          backdropFilter: "blur(20px)",
        }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: DS.text }}>{labItem.marker}</div>
            {labItem.category && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: DS.textMuted, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {labItem.category}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: "40px", height: "40px", borderRadius: "14px",
              border: `1px solid ${DS.border}`,
              background: "rgba(255,255,255,0.05)",
              color: DS.textSoft,
              fontSize: "18px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: "20px" }}>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "8px" }}>
                {getResultLabel(labItem)}
              </div>
              <div style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "52px", fontWeight: 700,
                color: DS.text, lineHeight: 0.9,
              }}>
                {labItem.value}
                <span style={{ fontSize: "18px", color: DS.textSoft, marginLeft: "8px" }}>{labItem.unit}</span>
              </div>
              {formattedDate && (
                <div style={{ fontSize: "12px", color: DS.textMuted, marginTop: "8px" }}>Result: {formattedDate}</div>
              )}
            </div>
            <span style={{
              borderRadius: "14px",
              border: `1px solid ${ss.border}`,
              background: ss.bg,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 800,
              color: ss.color,
            }}>
              {labItem.state}
            </span>
          </div>

          {/* Range visual */}
          <div style={{
            borderRadius: "16px",
            border: `1px solid ${DS.border}`,
            background: "rgba(255,255,255,0.02)",
            padding: "18px",
          }}>
            <RangeVisual lab={labItem} />
          </div>

          {/* Trend + Historical inline */}
          {hasHistory ? (
            <div style={{
              borderRadius: "14px",
              border: `1px solid ${DS.border}`,
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
            }}>
              {/* Trend header — clickable to expand history */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  width: "100%", padding: "14px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "transparent", border: "none", cursor: "pointer",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px", color: trend.color, fontWeight: 700 }}>
                    {labItem.trend === "up" ? "↑" : labItem.trend === "down" ? "↓" : "→"}
                  </span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: DS.text }}>
                      {labItem.trend === "up" ? "Trending up" : labItem.trend === "down" ? "Trending down" : "Stable"}
                    </div>
                    {(() => {
                      const prev = history.length > 1 ? history[1] : null;
                      if (prev) return (
                        <div style={{ fontSize: "12px", color: DS.textMuted, marginTop: "2px" }}>
                          Previous: <strong style={{ color: DS.textSoft }}>{prev.value} {prev.unit}</strong>
                          <span style={{ marginLeft: "6px" }}>· {formatDate(prev.date)}</span>
                        </div>
                      );
                      return null;
                    })()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: DS.teal }}>
                    {history.length} results
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={DS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: "transform 0.25s", transform: showHistory ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Timeline — expands inline */}
              {showHistory && (
                <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${DS.border}` }}>

                  {/* Pattern summary — top of timeline */}
                  {(() => {
                    const first = history[history.length - 1];
                    const current = history[0];
                    const firstVal = parseNumericValue(first.value);
                    const currentVal = parseNumericValue(current.value);
                    if (firstVal === null || currentVal === null) return null;
                    const delta = currentVal - firstVal;
                    const pct = Math.abs(Math.round((delta / firstVal) * 100));
                    const improved = delta < 0
                      ? current.state === "Optimal" || currentVal < firstVal
                      : current.state === "Optimal" || currentVal > firstVal;
                    const directionWord = delta > 0 ? "up" : delta < 0 ? "down" : "unchanged";
                    const sign = delta > 0 ? "+" : "";
                    return (
                      <div style={{
                        margin: "14px 0 18px",
                        borderRadius: "12px",
                        border: `1px solid rgba(45,212,191,0.15)`,
                        background: "rgba(45,212,191,0.05)",
                        borderLeft: `3px solid ${DS.teal}`,
                        padding: "12px 14px",
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.teal, marginBottom: "6px" }}>
                          Pattern over {history.length} results
                        </div>
                        <div style={{ fontSize: "13px", color: DS.text, lineHeight: 1.6 }}>
                          Since {formatDate(first.date)}, your {labItem.marker} has moved{" "}
                          <strong style={{ color: delta === 0 ? DS.textSoft : improved ? DS.green : DS.amber }}>
                            {sign}{delta.toFixed(2)} {labItem.unit} ({pct}% {directionWord})
                          </strong>.{" "}
                          {current.state === "Optimal"
                            ? "Currently in optimal range — keep the pattern going."
                            : current.state === "Watch"
                            ? "Still in Watch range — trend context matters more than the single number."
                            : "Attention range — this is the signal Meridian is tracking most closely."}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Timeline entries */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {history.map((entry, i) => {
                      const isCurrent = i === 0;
                      const entryStatus = statusStyle(entry.state);
                      const next = history[i + 1]; // older entry
                      const entryVal = parseNumericValue(entry.value);
                      const nextVal = next ? parseNumericValue(next.value) : null;
                      const delta = entryVal !== null && nextVal !== null ? entryVal - nextVal : null;
                      const deltaSign = delta !== null ? (delta > 0 ? "+" : "") : "";
                      const deltaColor = delta === null ? DS.textMuted
                        : delta === 0 ? DS.textMuted
                        : delta > 0 ? DS.amber : DS.green;

                      return (
                        <div key={`${entry.date}-${i}`} style={{ display: "flex", gap: "14px", alignItems: "flex-start", position: "relative" }}>
                          {/* Connector line */}
                          {i < history.length - 1 && (
                            <div style={{ position: "absolute", left: "6px", top: "16px", width: "1px", bottom: "-8px", background: DS.border }} />
                          )}
                          {/* Dot */}
                          <div style={{
                            width: "13px", height: "13px", borderRadius: "50%",
                            background: isCurrent ? entryStatus.color : "rgba(255,255,255,0.10)",
                            border: `2px solid ${isCurrent ? entryStatus.color : DS.border}`,
                            boxShadow: isCurrent ? `0 0 8px ${entryStatus.color}` : "none",
                            flexShrink: 0, marginTop: "3px", zIndex: 1,
                          }} />
                          {/* Content */}
                          <div style={{ flex: 1, paddingBottom: i < history.length - 1 ? "18px" : "0" }}>
                            {/* Value row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: 700, color: isCurrent ? DS.text : DS.textSoft }}>
                                  {entry.value}
                                  <span style={{ fontSize: "11px", fontWeight: 500, color: DS.textMuted, marginLeft: "4px" }}>{entry.unit}</span>
                                </span>
                                {isCurrent && (
                                  <span style={{ fontSize: "9px", fontWeight: 800, color: DS.teal, background: "rgba(45,212,191,0.10)", borderRadius: "999px", padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    Current
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: entryStatus.color, background: entryStatus.bg, border: `1px solid ${entryStatus.border}`, borderRadius: "999px", padding: "2px 8px", flexShrink: 0 }}>
                                {entry.state}
                              </span>
                            </div>
                            {/* Date + delta from previous */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                              <span style={{ fontSize: "11px", color: DS.textMuted }}>{formatDate(entry.date)}</span>
                              {delta !== null && (
                                <span style={{ fontSize: "10px", fontWeight: 700, color: deltaColor }}>
                                  {deltaSign}{delta.toFixed(2)} vs prior
                                </span>
                              )}
                            </div>
                            {/* Entry note if available */}
                            {entry.note && entry.note !== "Recorded lab result" && !isCurrent && (
                              <div style={{ fontSize: "11px", color: DS.textMuted, marginTop: "3px", fontStyle: "italic" }}>
                                {entry.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // No history — show simple trend block
            <div style={{ display: "flex", alignItems: "center", gap: "12px", borderRadius: "14px", border: `1px solid ${DS.border}`, background: "rgba(255,255,255,0.02)", padding: "14px 16px" }}>
              <span style={{ fontSize: "22px", color: trend.color, fontWeight: 700 }}>
                {labItem.trend === "up" ? "↑" : labItem.trend === "down" ? "↓" : "→"}
              </span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: DS.text }}>
                  {labItem.trend === "up" ? "Trending up" : labItem.trend === "down" ? "Trending down" : "Stable"}
                </div>
                {labItem.previous && labItem.previous !== "Not available" && (
                  <div style={{ fontSize: "12px", color: DS.textMuted, marginTop: "2px" }}>
                    Previous: <strong style={{ color: DS.textSoft }}>{labItem.previous}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          {labItem.note && labItem.note !== "Recorded lab result" && (
            <div style={{
              borderRadius: "14px",
              border: `1px solid rgba(45,212,191,0.18)`,
              borderLeft: `3px solid ${DS.teal}`,
              background: "rgba(45,212,191,0.05)",
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.teal, marginBottom: "6px" }}>
                Meridian note
              </div>
              <div style={{ fontSize: "14px", color: DS.text, lineHeight: 1.65 }}>{labItem.note}</div>
            </div>
          )}

          {/* ── INTELLIGENCE LAYER ── */}
          {(() => {
            const def = getMarkerDefinition(labItem.marker);
            const numeric = parseNumericValue(labItem.value);
            const prev = history.length > 1 ? history[1] : null;
            const prevNumeric = prev ? parseNumericValue(prev.value) : null;
            const range = labItem.range;

            // ── 1. PERSONAL CONTEXT ──────────────────────────────────
            const personalContext = (() => {
              if (!range || numeric === null) return null;

              const inOptimal = numeric >= range.optimalMin && numeric <= range.optimalMax;
              const inNormal = numeric >= range.normalMin && numeric <= range.normalMax;
              const distanceFromOptimalMin = numeric < range.optimalMin ? (range.optimalMin - numeric).toFixed(2) : null;
              const distanceFromOptimalMax = numeric > range.optimalMax ? (numeric - range.optimalMax).toFixed(2) : null;

              let positionSentence = "";
              if (inOptimal) {
                positionSentence = `Your current value is within optimal range (${range.optimalMin}–${range.optimalMax} ${labItem.unit}).`;
              } else if (inNormal && distanceFromOptimalMin) {
                positionSentence = `Your current value is ${distanceFromOptimalMin} ${labItem.unit} below your optimal floor of ${range.optimalMin} ${labItem.unit}.`;
              } else if (inNormal && distanceFromOptimalMax) {
                positionSentence = `Your current value is ${distanceFromOptimalMax} ${labItem.unit} above your optimal ceiling of ${range.optimalMax} ${labItem.unit}.`;
              } else if (numeric < range.normalMin) {
                positionSentence = `Your current value is below the normal range — this is the signal Meridian is tracking most closely.`;
              } else {
                positionSentence = `Your current value is above the normal range — this is the signal Meridian is tracking most closely.`;
              }

              let deltaSentence = "";
              if (prev && prevNumeric !== null) {
                const delta = numeric - prevNumeric;
                const sign = delta > 0 ? "+" : "";
                const direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "unchanged";
                deltaSentence = ` Since ${formatDate(prev.date)}, it has ${direction} by ${sign}${Math.abs(delta).toFixed(2)} ${labItem.unit}.`;
              }

              return positionSentence + deltaSentence;
            })();

            // ── 2. CONNECTED SIGNALS ─────────────────────────────────
            const connectedSignals = (() => {
              const latest = getLatestActiveLabs(allLabs);
              const find = (marker) => latest.find(l => l.marker === marker);
              const connections = [];

              // HDL ↔ Triglycerides
              if (labItem.marker === "HDL") {
                const tg = find("Triglycerides");
                if (tg) {
                  const tgVal = parseNumericValue(tg.value);
                  connections.push(tgVal && tgVal < 100
                    ? `Your Triglycerides are optimal (${tg.value} mg/dL), which typically supports HDL improvement. The gap in your HDL suggests slower adaptation in lipid transport, not energy metabolism.`
                    : `Your Triglycerides (${tg.value} mg/dL) are adding pressure to your lipid profile alongside HDL — both require attention together.`);
                }
              }

              // TSH ↔ HbA1c
              if (labItem.marker === "TSH") {
                const hba1c = find("HbA1c");
                if (hba1c) connections.push(`Your HbA1c (${hba1c.value}%) is ${hba1c.state === "Optimal" ? "stable" : "elevated"} — thyroid regulation and glucose metabolism interact directly. ${hba1c.state === "Optimal" ? "Glucose stability reduces one layer of metabolic pressure on thyroid function." : "Metabolic stress may be contributing to thyroid load."}`);
              }

              // HbA1c ↔ Glucose
              if (labItem.marker === "HbA1c") {
                const glucose = find("Glucose");
                if (glucose) connections.push(`Your fasting glucose (${glucose.value} mg/dL) is ${glucose.state === "Optimal" ? "consistent with this HbA1c result — both markers are aligned" : "showing a different pattern than your HbA1c — short-term vs long-term glucose regulation may diverge"}.`);
              }

              // eGFR ↔ Creatinine
              if (labItem.marker === "eGFR") {
                const creat = find("Creatinine");
                if (creat) connections.push(`Your Creatinine (${creat.value} mg/dL) is ${creat.state === "Optimal" ? "supporting this eGFR reading — kidney filtration markers are aligned" : "slightly elevated alongside this eGFR — both are part of the same kidney filtration signal"}.`);
              }

              // Vitamin D ↔ recovery
              if (labItem.marker === "Vitamin D") {
                const tsh = find("TSH");
                if (tsh) connections.push(`Your TSH (${tsh.value} mIU/L) is ${tsh.state === "Watch" ? "under pressure. Vitamin D deficiency can amplify thyroid stress — improving D levels may reduce this load" : "stable. Continued Vitamin D optimization supports the thyroid and immune systems simultaneously"}.`);
              }

              // LDL ↔ Total Cholesterol
              if (labItem.marker === "LDL") {
                const total = find("Total Cholesterol");
                if (total) connections.push(`Your Total Cholesterol (${total.value} mg/dL) ${total.state === "Optimal" ? "is well within range — LDL is the primary lipid signal to watch in your profile" : "is elevated alongside LDL, making this the dominant cardiovascular signal"}.`);
              }

              return connections.length > 0 ? connections[0] : null;
            })();

            // ── 3. MERIDIAN LOGIC ────────────────────────────────────
            const meridianLogic = (() => {
              const score = getPriorityScore(labItem);
              const allActive = getLatestActiveLabs(allLabs).filter(l => l.state !== "Optimal");
              const dominant = getDominantLabSignal(allLabs);
              const isDominant = dominant?.marker === labItem.marker;
              const totalWatch = allActive.length;

              if (isDominant) {
                return `This is the highest-priority signal in your current profile (score: ${score}). It is driving the primary action on your Home screen.`;
              }
              if (labItem.state === "Optimal") {
                return `This marker is Optimal and not generating an active signal. Meridian is monitoring it for trend changes. ${totalWatch > 0 ? `Current focus is on your ${totalWatch} Watch/Attention marker${totalWatch > 1 ? "s" : ""}.` : ""}`;
              }
              return `This marker is part of your ${def.system} signal (score: ${score}). ${dominant ? `Meridian is currently prioritizing ${dominant.marker} as the dominant signal, but this marker is tracked within the same biological cluster.` : ""}`;
            })();

            return (
              <>
                {/* Personal Context */}
                {personalContext && (
                  <div style={{
                    borderRadius: "14px",
                    border: `1px solid rgba(103,232,249,0.18)`,
                    borderLeft: `3px solid ${DS.cyan}`,
                    background: "rgba(103,232,249,0.04)",
                    padding: "14px 16px",
                  }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.cyan, marginBottom: "8px" }}>
                      Personal context
                    </div>
                    <div style={{ fontSize: "14px", color: DS.text, lineHeight: 1.7 }}>
                      {personalContext}
                    </div>
                  </div>
                )}

                {/* Connected Signals */}
                {connectedSignals && (
                  <div style={{
                    borderRadius: "14px",
                    border: `1px solid rgba(167,139,250,0.18)`,
                    borderLeft: `3px solid ${DS.purple}`,
                    background: "rgba(167,139,250,0.04)",
                    padding: "14px 16px",
                  }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.purple, marginBottom: "8px" }}>
                      Connected signals
                    </div>
                    <div style={{ fontSize: "14px", color: DS.text, lineHeight: 1.7 }}>
                      {connectedSignals}
                    </div>
                  </div>
                )}

                {/* Meridian Logic */}
                <div style={{
                  borderRadius: "14px",
                  border: `1px solid ${DS.border}`,
                  background: "rgba(255,255,255,0.02)",
                  padding: "14px 16px",
                }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "8px" }}>
                    Meridian logic
                  </div>
                  <div style={{ fontSize: "13px", color: DS.textSoft, lineHeight: 1.65 }}>
                    {meridianLogic}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: DS.textMuted }}>
                    {def.system} · {def.riskProfile} · priority score {getPriorityScore(labItem)}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Next recommended lab */}
          {formattedNext && (
            <div style={{
              borderRadius: "14px",
              border: `1px solid ${overdue ? "rgba(248,113,113,0.25)" : dueSoon ? "rgba(252,211,77,0.20)" : DS.border}`,
              background: overdue ? "rgba(248,113,113,0.06)" : dueSoon ? "rgba(252,211,77,0.05)" : "rgba(255,255,255,0.02)",
              padding: "14px 16px",
            }}>
              <div style={{
                fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: overdue ? DS.red : dueSoon ? DS.amber : DS.textMuted,
                marginBottom: "6px",
              }}>
                {overdue ? "⚠ Overdue" : "Next recommended lab"}
              </div>
              <div style={{
                fontSize: "15px", fontWeight: 600,
                color: overdue ? DS.red : DS.text,
              }}>
                {formattedNext}
              </div>
              {!overdue && daysUntilDue !== null && (
                <div style={{ fontSize: "12px", color: DS.textMuted, marginTop: "4px" }}>
                  {dueSoon
                    ? `In ${daysUntilDue} days`
                    : `In ${Math.round(daysUntilDue / 30)} month${Math.round(daysUntilDue / 30) !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>
          )}

          {/* Contributes to */}
          {labItem.contributesTo && labItem.contributesTo !== "Full Lab Record" && (
            <div style={{
              borderRadius: "14px",
              border: `1px solid rgba(167,139,250,0.20)`,
              background: "rgba(167,139,250,0.05)",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>✦</span>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.purple, marginBottom: "4px" }}>
                  Contributes to
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: DS.text }}>{labItem.contributesTo}</div>
              </div>
            </div>
          )}

          {/* Event context */}
          {labItem.eventContext && (
            <div style={{
              borderRadius: "14px",
              border: `1px solid ${DS.border}`,
              background: "rgba(255,255,255,0.02)",
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: DS.textMuted, marginBottom: "6px" }}>
                Event context
              </div>
              <div style={{ fontSize: "13px", color: DS.textSoft }}>{labItem.eventContext}</div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── LAB CARD ──────────────────────────────────────────────────────────────────
function LabCard({ lab: labItem, primary = false, onSelect }) {
  const ss = statusStyle(labItem.state);
  const trend = trendLabel(labItem.trend);
  const { formattedNext, overdue, dueSoon, daysUntilDue } = getLabStatusDates(labItem);

  // Smart badge logic
  const badgeLabel = overdue
    ? "Overdue"
    : dueSoon
    ? `Due in ${daysUntilDue}d`
    : formattedNext
    ? `Next: ${formattedNext}`
    : null;

  const badgeColor = overdue ? DS.red : dueSoon ? DS.amber : DS.textMuted;
  const badgeBg = overdue
    ? "rgba(248,113,113,0.10)"
    : dueSoon
    ? "rgba(252,211,77,0.10)"
    : "rgba(255,255,255,0.04)";

  return (
    <div
      onClick={() => onSelect(labItem)}
      style={{
        ...glassCard,
        padding: primary ? "22px" : "16px",
        cursor: "pointer",
        marginBottom: primary ? "16px" : "0",
        position: "relative",
      }}
      onMouseOver={e => { e.currentTarget.style.borderColor = DS.border2; e.currentTarget.style.background = DS.card2; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.background = DS.card; }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: primary ? "16px" : "13px", fontWeight: 700, color: DS.text, marginBottom: "4px" }}>
            {labItem.marker}
          </div>
          {/* Result label — small, above the big number */}
          <div style={{
            fontSize: "9px", fontWeight: 800,
            letterSpacing: "0.10em", textTransform: "uppercase",
            color: DS.textMuted, marginBottom: "4px",
          }}>
            {getResultLabel(labItem)}
          </div>
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: primary ? "38px" : "28px",
            fontWeight: 700,
            color: DS.text,
            lineHeight: 1,
          }}>
            {labItem.value}
            <span style={{ fontSize: primary ? "15px" : "12px", fontWeight: 500, color: DS.textSoft, marginLeft: "6px", fontFamily: "inherit" }}>
              {labItem.unit}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{
            display: "inline-block",
            borderRadius: "999px",
            border: `1px solid ${ss.border}`,
            background: ss.bg,
            padding: "4px 12px",
            fontSize: "10px",
            fontWeight: 800,
            color: ss.color,
          }}>
            {labItem.state}
          </span>
          <div style={{ fontSize: "11px", fontWeight: 600, color: trend.color, marginTop: "5px" }}>
            {trend.label}
          </div>
          {getTrendContext(labItem.trend, labItem.state) && (
            <div style={{ fontSize: "10px", fontWeight: 600, color: DS.textMuted, marginTop: "3px" }}>
              {getTrendContext(labItem.trend, labItem.state)}
            </div>
          )}
        </div>
      </div>

      {/* Range visual */}
      <RangeVisual lab={labItem} />

      {/* Bottom row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: "14px",
      }}>
        <div style={{ fontSize: "12px", color: DS.textSoft }}>{labItem.note}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {badgeLabel && (
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: badgeColor,
              background: badgeBg,
              borderRadius: "999px",
              padding: "3px 8px",
              whiteSpace: "nowrap",
            }}>
              {badgeLabel}
            </span>
          )}
          <span style={{ fontSize: "12px", color: DS.textMuted }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ── SELF TESTS (unchanged) ────────────────────────────────────────────────────
function validateDemoUsers(users) {
  const required = ["id", "name", "biologicalProfile", "userProfile", "headline", "status", "actions", "trust", "connectedInsight", "toneMode", "severity", "labs"];
  return Object.values(users).every((user) =>
    required.every((key) => user[key] !== undefined) &&
    user.actions.length >= 3 &&
    user.connectedInsight.signals.length >= 3 &&
    user.labs.length >= 2
  );
}

function runSelfTests() {
  const results = [
    { name: "demo users include required fields", passed: validateDemoUsers(demoUsers) },
    { name: "morning greeting", passed: getGreeting(new Date("2026-05-04T08:00:00")) === "Good morning" },
    { name: "afternoon greeting", passed: getGreeting(new Date("2026-05-04T13:00:00")) === "Good afternoon" },
    { name: "evening greeting", passed: getGreeting(new Date("2026-05-04T20:00:00")) === "Good evening" },
    { name: "range percent clamps high", passed: getRangePercent("999", { scaleMin: 0, scaleMax: 100 }) === 98 },
    { name: "range percent clamps low", passed: getRangePercent("-999", { scaleMin: 0, scaleMax: 100 }) === 2 },
    { name: "result label uses latest when previous exists", passed: getResultLabel(lab("TSH", "3", "mIU/L", "2026-01-01", "Watch", { previous: "4" })) === "Latest result" },
    { name: "result label uses current level when no previous", passed: getResultLabel(lab("TSH", "3", "mIU/L", "2026-01-01", "Watch")) === "Current level" },
    { name: "supporting actions capped at two", passed: getVisibleSupportingActions(["main", "a", "b", "c"]).length === 2 },
    { name: "trust line normalizes suffix", passed: normalizeTrustLine("Derived from labs").endsWith("Meridian interprets, you decide") },
    { name: "priority score ranks attention above optimal", passed: getPriorityScore(lab("ALT", "80", "U/L", "2026-01-01", "Attention", { trend: "watch" })) > getPriorityScore(lab("ALT", "20", "U/L", "2026-01-01", "Optimal")) },
    { name: "dominant signal ignores optimal markers", passed: getDominantLabSignal([lab("HbA1c", "4.8", "%", "2026-01-01", "Optimal"), lab("TSH", "3.03", "mIU/L", "2026-01-01", "Watch")])?.marker === "TSH" },
    { name: "dominant action uses arbitrator", passed: typeof generateDominantAction(demoUsers.stephanie, lab("TSH", "3.03", "mIU/L", "2026-01-01", "Watch")) === "string" },
  ];
  const failed = results.filter((t) => !t.passed);
  if (failed.length > 0) console.error("Meridian self-tests failed:", failed.map((t) => t.name).join(", "));
  else console.log("✓ All Meridian self-tests passed");
}

// ── INSIGHTS PAGE ─────────────────────────────────────────────────────────────
function PulsingDot() {
  return (
    <div style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: DS.teal, boxShadow: `0 0 10px ${DS.teal}`,
      animation: "ping 1.5s ease-in-out infinite",
      flexShrink: 0,
    }} />
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={DS.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GoldenInsightCard({ insight, index }) {
  const isActive  = insight.status === "active";
  const isPartial = insight.status === "partial";
  const isLocked  = insight.status === "locked";
  const borderColor = isActive ? DS.teal : isPartial ? DS.amber : DS.textMuted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ...glassCard,
        borderLeft: `4px solid ${borderColor}`,
        padding: "20px",
        opacity: isLocked ? 0.55 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        {isActive && <PulsingDot />}
        {isLocked && <LockIcon />}
        <h3 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: "15px", fontWeight: 700,
          color: isLocked ? DS.textMuted : DS.text,
          margin: 0, letterSpacing: "-0.01em",
        }}>
          {insight.title}
        </h3>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: "13px", color: isLocked ? DS.textMuted : DS.textSoft, margin: "0 0 12px", lineHeight: 1.5 }}>
        {insight.subtitle}
      </p>

      {/* Markers */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
        {insight.markers.map(m => (
          <span key={m} style={{
            borderRadius: "999px", border: `1px solid ${DS.border}`,
            background: "rgba(255,255,255,0.03)",
            padding: "4px 10px", fontSize: "10px", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: isLocked ? DS.textMuted : DS.textSoft,
          }}>
            {m}
          </span>
        ))}
      </div>

      {/* Body */}
      {isLocked ? (
        <div style={{
          borderRadius: "12px", border: `1px solid ${DS.border}`,
          background: "rgba(255,255,255,0.02)", padding: "12px 14px",
          fontSize: "12px", color: DS.textMuted,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <LockIcon /><span>Add labs to unlock</span>
        </div>
      ) : (
        <p style={{ fontSize: "13px", color: DS.textSoft, margin: 0, lineHeight: 1.6 }}>
          {insight.description}
        </p>
      )}

      {/* Active signal */}
      {isActive && insight.activeSignal && (
        <div style={{
          marginTop: "12px", borderRadius: "12px",
          border: `1px solid rgba(45,212,191,0.20)`,
          background: "rgba(45,212,191,0.06)",
          padding: "10px 14px", fontSize: "12px",
          color: DS.teal, fontWeight: 600,
        }}>
          <span style={{ fontWeight: 800, marginRight: "6px" }}>Active signal:</span>
          {insight.activeSignal}
        </div>
      )}
    </motion.div>
  );
}

function buildInsights(user) {
  const latest = user.labs.length > 0
    ? (() => {
        const grouped = new Map();
        user.labs
          .filter(l => l.visibility !== "archived")
          .forEach(l => {
            const ex = grouped.get(l.marker);
            if (!ex || new Date(l.date) > new Date(ex.date)) grouped.set(l.marker, l);
          });
        return Object.fromEntries(grouped);
      })()
    : {};

  const has = (...markers) => markers.some(m => latest[m]);
  const val  = (m) => latest[m] ? parseFloat(latest[m].value) : null;
  const st   = (m) => latest[m]?.state || null;

  const insights = [
    {
      id: "oxygen-reserve",
      title: "Oxygen Reserve",
      subtitle: "Ferritin · HRV · RHR — your blood's ability to carry energy",
      markers: ["Ferritin", "HRV", "RHR"],
      description: has("Ferritin")
        ? `Your iron transport capacity affects every recovery signal. ${val("Ferritin") && val("Ferritin") < 30 ? "Low Ferritin limits oxygen delivery — this may explain why your HRV and RHR suggest more strain than your training load justifies." : "Your Ferritin is supporting oxygen transport. Monitor with wearable HRV for full picture."}`
        : "When Ferritin is low, your heart compensates by working harder — even at rest. This axis connects iron levels to your recovery wearable data.",
      status: has("Ferritin") ? (val("Ferritin") && val("Ferritin") < 40 ? "active" : "partial") : "locked",
      activeSignal: has("Ferritin") && val("Ferritin") && val("Ferritin") < 40
        ? `Ferritin ${latest["Ferritin"]?.value} ng/mL — below threshold for optimal oxygen transport`
        : undefined,
    },
    {
      id: "metabolic-stress",
      title: "Metabolic Stress",
      subtitle: "HbA1c · REM sleep — glucose stability while you sleep",
      markers: ["HbA1c", "Glucose", "REM Sleep"],
      description: has("HbA1c")
        ? `Your HbA1c (${latest["HbA1c"]?.value}%) reflects 90-day glucose regulation. ${val("HbA1c") && val("HbA1c") > 5.4 ? "Values above 5.4% can cause nocturnal cortisol spikes that fragment REM sleep — even when the number looks 'normal' on a standard report." : "Your glucose regulation is currently stable. Consistent meal timing will protect this signal."}`
        : "Glucose instability at night disrupts REM sleep through cortisol spikes. This insight activates when HbA1c data is available.",
      status: has("HbA1c") ? (val("HbA1c") && val("HbA1c") > 5.4 ? "active" : "partial") : "locked",
      activeSignal: has("HbA1c") && val("HbA1c") && val("HbA1c") > 5.4
        ? `HbA1c ${latest["HbA1c"]?.value}% — above 5.4 threshold for nocturnal metabolic stress`
        : undefined,
    },
    {
      id: "inflammation",
      title: "Silent Inflammation",
      subtitle: "hsCRP · Body temperature · Deep sleep",
      markers: ["hsCRP", "Temperature", "Deep Sleep"],
      description: has("hsCRP")
        ? `Elevated inflammation taxes your recovery budget before training begins. ${val("hsCRP") && val("hsCRP") > 1.0 ? "Your hsCRP suggests active low-grade inflammation. Combined with wearable temperature data, this can explain reduced deep sleep and slower recovery." : "Your inflammation markers are currently in range. Consistent sleep timing and anti-inflammatory nutrition will protect this."}`
        : "Low-grade inflammation is invisible without labs — you feel it as slower recovery and reduced deep sleep. This insight connects CRP to your wearable temperature baseline.",
      status: has("hsCRP") ? (val("hsCRP") && val("hsCRP") > 1.0 ? "active" : "partial") : "locked",
      activeSignal: has("hsCRP") && val("hsCRP") && val("hsCRP") > 1.0
        ? `hsCRP ${latest["hsCRP"]?.value} mg/L — above 1.0 threshold for low-grade inflammation`
        : undefined,
    },
    {
      id: "thyroid-brake",
      title: "Thyroid Brake",
      subtitle: "TSH · Free T3 · Nocturnal RHR",
      markers: ["TSH", "Free T3", "RHR"],
      description: has("TSH")
        ? `Your thyroid regulates metabolic rate, body temperature, and energy conversion. ${val("TSH") && val("TSH") > 2.5 ? `TSH at ${latest["TSH"]?.value} mIU/L suggests your metabolism is under pressure. This can explain fatigue before noon, cold sensitivity, and a flat nocturnal RHR pattern.` : "Your thyroid markers are currently within optimal range. Continue monitoring — TSH is highly sensitive to stress and sleep patterns."}`
        : "When thyroid output drops, metabolism slows at the cellular level — affecting energy, temperature, and recovery. This insight connects TSH to your daily wearable patterns.",
      status: has("TSH") ? (val("TSH") && val("TSH") > 2.5 ? "active" : "partial") : "locked",
      activeSignal: has("TSH") && val("TSH") && val("TSH") > 2.5
        ? `TSH ${latest["TSH"]?.value} mIU/L — above 2.5 optimal ceiling`
        : undefined,
    },
    {
      id: "hormonal-window",
      title: "Hormonal Performance Window",
      subtitle: "Cycle phase · Cortisol · HRV",
      markers: ["Cycle Phase", "Cortisol", "HRV"],
      description: user.biologicalProfile === "Female biology"
        ? has("Cortisol AM")
          ? `Stress resilience fluctuates predictably across the menstrual cycle. ${val("Cortisol AM") && val("Cortisol AM") > 18 ? "Elevated cortisol combined with late luteal phase biology reduces HRV and amplifies the inflammatory response to high-intensity training." : "Your cortisol baseline is in range. Aligning training intensity with your cycle phase will protect your recovery window."}`
          : "Training performance, recovery speed, and stress tolerance all shift across your cycle. This insight becomes active when cortisol data and cycle tracking are connected."
        : "This insight is designed for female biology and menstrual cycle tracking.",
      status: user.biologicalProfile !== "Female biology"
        ? "locked"
        : has("Cortisol AM")
          ? (val("Cortisol AM") && val("Cortisol AM") > 18 ? "active" : "partial")
          : "locked",
      activeSignal: user.biologicalProfile === "Female biology" && has("Cortisol AM") && val("Cortisol AM") && val("Cortisol AM") > 18
        ? `Cortisol AM ${latest["Cortisol AM"]?.value} µg/dL — elevated, stress resilience reduced`
        : undefined,
    },
  ];

  return insights;
}

function InsightsView({ user }) {
  const insights = buildInsights(user);
  const activeCount  = insights.filter(i => i.status === "active").length;
  const partialCount = insights.filter(i => i.status === "partial").length;
  const lockedCount  = insights.filter(i => i.status === "locked").length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 700, letterSpacing: "-0.04em",
          color: DS.text, margin: "0 0 8px",
        }}>
          Insights
        </h2>
        <p style={{ fontSize: "14px", color: DS.textSoft, margin: "0 0 16px" }}>
          The 5 biological connections that matter most.
        </p>
        {/* Summary row */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {activeCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: DS.teal, background: "rgba(45,212,191,0.08)", borderRadius: "999px", padding: "4px 10px" }}>
              {activeCount} active
            </span>
          )}
          {partialCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: DS.textSoft, background: "rgba(255,255,255,0.05)", borderRadius: "999px", padding: "4px 10px" }}>
              {partialCount} partial
            </span>
          )}
          {lockedCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: DS.textMuted, background: "rgba(255,255,255,0.03)", borderRadius: "999px", padding: "4px 10px" }}>
              {lockedCount} need labs
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gap: "16px" }}>
        {insights.map((insight, i) => (
          <GoldenInsightCard key={insight.id} insight={insight} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function MeridianPhase1Demo() {
  const [selectedUser, setSelectedUser] = useState("stephanie");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [view, setView] = useState("home");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedLab, setSelectedLab] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const user = demoUsers[selectedUser] || demoUsers.stephanie;
  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => runSelfTests(), []);

  const activeLatestLabs = useMemo(() => getLatestActiveLabs(user.labs), [user.labs]);
  const archivedLabs = useMemo(() => getArchivedLabs(user.labs), [user.labs]);
  const sortedLabs = useMemo(() => {
    return [...activeLatestLabs].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  }, [activeLatestLabs]);

  const primaryLab = sortedLabs[0];
  const secondaryLabs = sortedLabs.slice(1);
  const dominantSignal = useMemo(() => getDominantLabSignal(user.labs), [user.labs]);

  return (
    <div style={{
      minHeight: "100vh",
      background: DS.bg,
      color: DS.text,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute",
          top: "-180px", left: "-140px",
          width: "520px", height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45,212,191,0.18), transparent 62%)",
          filter: "blur(80px)",
          animation: "orbDrift 20s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute",
          right: "-160px", bottom: "-120px",
          width: "460px", height: "460px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(103,232,249,0.14), transparent 64%)",
          filter: "blur(80px)",
          animation: "orbDrift 26s ease-in-out infinite alternate-reverse",
        }} />
      </div>

      <style>{`
        @keyframes orbDrift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(50px, 40px) scale(1.07); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: "12px", zIndex: 50,
        margin: "0 16px 0",
      }}>
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 22px",
          borderRadius: "24px",
          border: `1px solid ${DS.border}`,
          background: "rgba(4,14,16,0.80)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "46px", height: "46px", borderRadius: "16px",
              background: "linear-gradient(145deg, rgba(45,212,191,0.16), rgba(103,232,249,0.08))",
              border: `1px solid rgba(103,232,249,0.20)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(45,212,191,0.12)",
            }}>
              <span style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "32px",
                fontWeight: 700,
                lineHeight: 0.85,
                letterSpacing: "-0.06em",
                background: "linear-gradient(135deg, #FFFFFF 0%, #67E8F9 40%, #2DD4BF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "block",
              }}>M</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.04em", color: DS.text }}>
                Meridian
              </div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.textMuted }}>
                Health Intelligence · {MERIDIAN_VERSION}
              </div>
            </div>
          </div>

          {/* Nav + user switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {["home", "labs", "insights"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  background: view === v ? `linear-gradient(135deg, ${DS.teal}, ${DS.cyan})` : "transparent",
                  color: view === v ? DS.bg : DS.textSoft,
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
              >
                <Icon name={v === "home" ? "home" : v === "labs" ? "flask" : "insights"} size={13} color={view === v ? DS.bg : DS.textSoft} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}

            {/* User switcher */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: `1px solid ${DS.border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: DS.textSoft,
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <Icon name="user" size={14} color={DS.textSoft} />
                {user.name}
                <Icon name="chevronDown" size={13} color={DS.textMuted} />
              </button>

              {dropdownOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  width: "220px",
                  borderRadius: "18px",
                  border: `1px solid ${DS.border}`,
                  background: "rgba(4,14,16,0.96)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                  overflow: "hidden",
                  zIndex: 100,
                }}>
                  {Object.values(demoUsers).map((demo) => (
                    <button
                      key={demo.id}
                      onClick={() => { setSelectedUser(demo.id); setDropdownOpen(false); }}
                      style={{
                        display: "block", width: "100%", padding: "14px 18px",
                        textAlign: "left",
                        background: selectedUser === demo.id ? "rgba(45,212,191,0.08)" : "transparent",
                        border: "none",
                        borderBottom: `1px solid ${DS.border}`,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={e => { if (selectedUser !== demo.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseOut={e => { if (selectedUser !== demo.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 700, color: DS.text }}>{demo.name}</div>
                      <div style={{ fontSize: "11px", color: DS.textMuted, marginTop: "2px" }}>{demo.role}</div>
                      <div style={{ fontSize: "10px", color: DS.textMuted, marginTop: "1px" }}>{demo.biologicalProfile}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        position: "relative", zIndex: 1,
        maxWidth: "900px",
        margin: "0 auto",
        padding: "24px 16px 100px",
      }}>

        {/* HOME VIEW */}
        {view === "home" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* Greeting */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{
                fontSize: "11px", fontWeight: 800, letterSpacing: "0.11em",
                textTransform: "uppercase", color: DS.teal, marginBottom: "8px",
                display: "flex", alignItems: "center", gap: "7px",
              }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: DS.teal, boxShadow: `0 0 8px ${DS.teal}`,
                  display: "inline-block",
                }} />
                {user.labRecency}
              </div>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(32px, 5vw, 48px)",
                fontWeight: 700,
                letterSpacing: "-0.05em",
                lineHeight: 1.05,
                color: DS.text,
                margin: 0,
              }}>
                {greeting},{" "}
                <em style={{
                  fontStyle: "normal",
                  background: `linear-gradient(135deg, #FFFFFF 0%, ${DS.cyan} 44%, ${DS.teal} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {user.name}
                </em>
              </h2>
            </div>

            <IntelligenceBlockRouter user={user} dominantSignal={dominantSignal} onGoToLabs={() => setView("labs")} />
            <SupportingContextSeparator />
          </motion.div>
        )}

        {/* LABS VIEW */}
        {view === "labs" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: DS.text,
                margin: "0 0 8px",
              }}>Lab Signals</h2>
              <p style={{ fontSize: "14px", color: DS.textSoft, margin: 0 }}>
                Latest active result per marker · tap to explore · {user.labRecency}
              </p>
            </div>

            <UploadLabsBlock onStartReview={() => setReviewOpen(true)} />

            {primaryLab && <LabCard lab={primaryLab} primary onSelect={setSelectedLab} />}

            {(() => {
              const grouped = groupLabsBySystem(secondaryLabs);
              return Object.entries(grouped).map(([system, labs]) => (
                <div key={system} style={{ marginTop: "24px" }}>
                  <h3 style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: DS.textMuted,
                    marginBottom: "12px",
                  }}>
                    {system}
                  </h3>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
                    gap: "12px",
                  }}>
                    {labs.map((labItem, i) => (
                      <LabCard key={`${labItem.marker}-${labItem.date}-${i}`} lab={labItem} onSelect={setSelectedLab} />
                    ))}
                  </div>
                </div>
              ));
            })()}

            {archivedLabs.length > 0 && (
              <div style={{ marginTop: "28px" }}>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "14px",
                    border: `1px solid ${DS.border}`,
                    background: "rgba(255,255,255,0.03)",
                    color: DS.textSoft,
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                >
                  {showArchived ? "Hide archived events" : `View archived events (${archivedLabs.length})`}
                </button>

                {showArchived && (
                  <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: "12px" }}>
                    {archivedLabs.map((labItem, index) => (
                      <LabCard key={`archived-${labItem.marker}-${labItem.date}-${index}`} lab={labItem} onSelect={setSelectedLab} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* INSIGHTS VIEW */}
        {view === "insights" && (
          <InsightsView user={user} />
        )}
      </main>

      {reviewOpen && (
        <LabReviewModal
          onClose={() => setReviewOpen(false)}
          onConfirm={() => setReviewOpen(false)}
        />
      )}

      {/* ── LAB DETAIL MODAL ── */}
      {selectedLab && (
        <LabDetailModal
          lab={selectedLab}
          onClose={() => setSelectedLab(null)}
          allLabs={user.labs}
        />
      )}

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav style={{
        position: "fixed", bottom: "12px", left: "12px", right: "12px",
        zIndex: 50,
        display: "flex", justifyContent: "space-around",
        padding: "10px 8px",
        borderRadius: "22px",
        border: `1px solid ${DS.border}`,
        background: "rgba(2,7,7,0.92)",
        backdropFilter: "blur(28px)",
      }}
        className="md:hidden"
      >
        {[
          { id: "home", icon: "home", label: "Home" },
          { id: "labs", icon: "flask", label: "Labs" },
          { id: "insights", icon: "insights", label: "Insights" },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
              padding: "11px 20px",
              borderRadius: "14px",
              border: "none",
              background: view === id ? `linear-gradient(135deg, ${DS.teal}, ${DS.cyan})` : "transparent",
              color: view === id ? DS.bg : DS.textSoft,
              fontSize: "10px",
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            <Icon name={icon} size={18} color={view === id ? DS.bg : DS.textSoft} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
