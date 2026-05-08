// MERIDIAN — Canonical Biomarker Dictionary v2
// Expanded to cover markers found in user's real lab PDFs
// Includes: thyroid panel, CBC differential, electrolytes, lipid panel details

export type RiskProfile = 'linear-high' | 'linear-low' | 'u-shaped' | 'context'

export interface CanonicalMarker {
  slug: string
  name: string
  unit: string
  aliases: string[]
  system: string
  riskProfile: RiskProfile
  normalF: { min: number; max: number }
  normalM: { min: number; max: number }
  optimalF: { min: number; max: number }
  optimalM: { min: number; max: number }
  impossibleMin: number
  impossibleMax: number
  priorityWeight: number
}

export const CANONICAL_DICTIONARY: Record<string, CanonicalMarker> = {
  // ===== THYROID =====
  tsh: {
    slug: 'tsh',
    name: 'TSH',
    unit: 'mIU/L',
    aliases: ['tsh', 'thyrotropin', 't.s.h.', 'hormona tiroestimulante', 'thyroid stimulating hormone', 'tirotropina', 'serum tsh'],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.4, max: 4.0 },
    normalM: { min: 0.4, max: 4.0 },
    optimalF: { min: 0.5, max: 2.5 },
    optimalM: { min: 0.5, max: 2.5 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 5,
  },
  free_t4: {
    slug: 'free_t4',
    name: 'Free T4',
    unit: 'ng/dL',
    aliases: ['free t4', 'ft4', 'free thyroxine', 'free thyroxine ft4', 't4 libre', 'tiroxina libre', 't4 free', 'thyroxine free'],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.8, max: 1.8 },
    normalM: { min: 0.8, max: 1.8 },
    optimalF: { min: 1.0, max: 1.5 },
    optimalM: { min: 1.0, max: 1.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 4,
  },
  free_t3: {
    slug: 'free_t3',
    name: 'Free T3',
    unit: 'pg/mL',
    aliases: ['free t3', 'ft3', 'triiodothyronine free', 't3 libre', 'triiodotironina libre', 't3 free'],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 2.0, max: 4.4 },
    normalM: { min: 2.0, max: 4.4 },
    optimalF: { min: 2.8, max: 3.8 },
    optimalM: { min: 2.8, max: 3.8 },
    impossibleMin: 0,
    impossibleMax: 20,
    priorityWeight: 4,
  },
  total_t3: {
    slug: 'total_t3',
    name: 'Total T3',
    unit: 'ng/mL',
    aliases: ['total t3', 't3 total', 't3', 'triiodothyronine', 'triiodotironina'],
    system: 'thyroid',
    riskProfile: 'u-shaped',
    normalF: { min: 0.6, max: 1.81 },
    normalM: { min: 0.6, max: 1.81 },
    optimalF: { min: 0.8, max: 1.5 },
    optimalM: { min: 0.8, max: 1.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 3,
  },

  // ===== METABOLIC =====
  hba1c: {
    slug: 'hba1c',
    name: 'Hemoglobin A1c',
    unit: '%',
    aliases: ['hba1c', 'a1c', 'glycated hemoglobin', 'hemoglobina glicosilada', 'glycated hb', 'hemoglobin a1c', 'hb a1c'],
    system: 'metabolic',
    riskProfile: 'linear-high',
    normalF: { min: 4.0, max: 5.6 },
    normalM: { min: 4.0, max: 5.6 },
    optimalF: { min: 4.5, max: 5.2 },
    optimalM: { min: 4.5, max: 5.2 },
    impossibleMin: 2,
    impossibleMax: 20,
    priorityWeight: 5,
  },
  glucose_fasting: {
    slug: 'glucose_fasting',
    name: 'Fasting Glucose',
    unit: 'mg/dL',
    aliases: ['glucose', 'glucosa', 'glucose fasting', 'glucosa ayunas', 'blood sugar', 'glicemia', 'glucosa basal', 'fasting glucose', 'fasting blood sugar', 'blood glucose'],
    system: 'metabolic',
    riskProfile: 'u-shaped',
    normalF: { min: 70, max: 100 },
    normalM: { min: 70, max: 100 },
    optimalF: { min: 75, max: 90 },
    optimalM: { min: 75, max: 90 },
    impossibleMin: 10,
    impossibleMax: 800,
    priorityWeight: 5,
  },
  insulin_fasting: {
    slug: 'insulin_fasting',
    name: 'Fasting Insulin',
    unit: 'µIU/mL',
    aliases: ['insulin', 'insulina', 'fasting insulin', 'insulina ayunas', 'inmunorreactiva', 'serum insulin'],
    system: 'metabolic',
    riskProfile: 'linear-high',
    normalF: { min: 2.0, max: 25.0 },
    normalM: { min: 2.0, max: 25.0 },
    optimalF: { min: 2.5, max: 8.0 },
    optimalM: { min: 2.5, max: 8.0 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 5,
  },

  // ===== CARDIOVASCULAR / LIPIDS =====
  hdl: {
    slug: 'hdl',
    name: 'HDL Cholesterol',
    unit: 'mg/dL',
    aliases: ['hdl', 'hdl-c', 'hdl cholesterol', 'colesterol hdl', 'lipoproteina alta densidad', 'high density lipoprotein', 'hdl-cholesterol'],
    system: 'cardiovascular',
    riskProfile: 'linear-low',
    normalF: { min: 50, max: 100 },
    normalM: { min: 40, max: 100 },
    optimalF: { min: 60, max: 90 },
    optimalM: { min: 50, max: 80 },
    impossibleMin: 5,
    impossibleMax: 200,
    priorityWeight: 4,
  },
  ldl: {
    slug: 'ldl',
    name: 'LDL Cholesterol',
    unit: 'mg/dL',
    aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'colesterol ldl', 'lipoproteina baja densidad', 'low density lipoprotein', 'ldl-cholesterol', 'ldl calculated', 'ldl calc'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 130 },
    normalM: { min: 0, max: 130 },
    optimalF: { min: 0, max: 100 },
    optimalM: { min: 0, max: 100 },
    impossibleMin: 0,
    impossibleMax: 500,
    priorityWeight: 4,
  },
  triglycerides: {
    slug: 'triglycerides',
    name: 'Triglycerides',
    unit: 'mg/dL',
    aliases: ['triglycerides', 'trigliceridos', 'trig', 'tg', 'triacylglycerols'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 150 },
    normalM: { min: 0, max: 150 },
    optimalF: { min: 40, max: 100 },
    optimalM: { min: 40, max: 100 },
    impossibleMin: 0,
    impossibleMax: 3000,
    priorityWeight: 4,
  },
  total_cholesterol: {
    slug: 'total_cholesterol',
    name: 'Total Cholesterol',
    unit: 'mg/dL',
    aliases: ['total cholesterol', 'cholesterol total', 'colesterol total', 'cholesterol', 'tc'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 100, max: 200 },
    normalM: { min: 100, max: 200 },
    optimalF: { min: 120, max: 180 },
    optimalM: { min: 120, max: 180 },
    impossibleMin: 30,
    impossibleMax: 600,
    priorityWeight: 3,
  },
  homocysteine: {
    slug: 'homocysteine',
    name: 'Homocysteine',
    unit: 'µmol/L',
    aliases: ['homocysteine', 'homocisteina', 'hcy', 'homocystine'],
    system: 'cardiovascular',
    riskProfile: 'linear-high',
    normalF: { min: 4.0, max: 15.0 },
    normalM: { min: 4.0, max: 15.0 },
    optimalF: { min: 5.0, max: 9.0 },
    optimalM: { min: 5.0, max: 9.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 4,
  },

  // ===== LIVER =====
  ast: {
    slug: 'ast',
    name: 'AST',
    unit: 'U/L',
    aliases: ['ast', 'asat', 'sgot', 'aspartato aminotransferasa', 'aspartate aminotransferase'],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 5, max: 35 },
    normalM: { min: 5, max: 40 },
    optimalF: { min: 10, max: 26 },
    optimalM: { min: 10, max: 30 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  alt: {
    slug: 'alt',
    name: 'ALT',
    unit: 'U/L',
    aliases: ['alt', 'alat', 'sgpt', 'alanina aminotransferasa', 'alanine aminotransferase'],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 5, max: 35 },
    normalM: { min: 5, max: 45 },
    optimalF: { min: 7, max: 25 },
    optimalM: { min: 7, max: 30 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  alkaline_phosphatase: {
    slug: 'alkaline_phosphatase',
    name: 'Alkaline Phosphatase',
    unit: 'U/L',
    aliases: ['alkaline phosphatase', 'alp', 'alk phos', 'fosfatasa alcalina', 'alkp'],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 35, max: 105 },
    normalM: { min: 40, max: 130 },
    optimalF: { min: 45, max: 85 },
    optimalM: { min: 50, max: 100 },
    impossibleMin: 0,
    impossibleMax: 2000,
    priorityWeight: 2,
  },
  bilirubin_total: {
    slug: 'bilirubin_total',
    name: 'Total Bilirubin',
    unit: 'mg/dL',
    aliases: ['total bilirubin', 'bilirubin total', 'bilirrubina total', 'bilirubin', 'tbil'],
    system: 'liver',
    riskProfile: 'linear-high',
    normalF: { min: 0.1, max: 1.2 },
    normalM: { min: 0.1, max: 1.2 },
    optimalF: { min: 0.2, max: 0.8 },
    optimalM: { min: 0.2, max: 0.8 },
    impossibleMin: 0,
    impossibleMax: 40,
    priorityWeight: 2,
  },
  total_protein: {
    slug: 'total_protein',
    name: 'Total Protein',
    unit: 'g/dL',
    aliases: ['total protein', 'proteina total', 'protein total', 'tp'],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 6.0, max: 8.3 },
    normalM: { min: 6.0, max: 8.3 },
    optimalF: { min: 6.5, max: 7.5 },
    optimalM: { min: 6.5, max: 7.5 },
    impossibleMin: 1,
    impossibleMax: 15,
    priorityWeight: 2,
  },
  albumin: {
    slug: 'albumin',
    name: 'Albumin',
    unit: 'g/dL',
    aliases: ['albumin', 'albumina', 'alb', 'serum albumin'],
    system: 'liver',
    riskProfile: 'linear-low',
    normalF: { min: 3.5, max: 5.5 },
    normalM: { min: 3.5, max: 5.5 },
    optimalF: { min: 4.0, max: 5.0 },
    optimalM: { min: 4.0, max: 5.0 },
    impossibleMin: 0,
    impossibleMax: 8,
    priorityWeight: 2,
  },
  globulin: {
    slug: 'globulin',
    name: 'Globulin',
    unit: 'g/dL',
    aliases: ['globulin', 'globulina'],
    system: 'liver',
    riskProfile: 'u-shaped',
    normalF: { min: 1.5, max: 4.5 },
    normalM: { min: 1.5, max: 4.5 },
    optimalF: { min: 2.0, max: 3.5 },
    optimalM: { min: 2.0, max: 3.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },

  // ===== KIDNEY =====
  egfr: {
    slug: 'egfr',
    name: 'eGFR',
    unit: 'mL/min',
    aliases: ['egfr', 'gfr', 'e-gfr', 'tfg', 'creatinine clearance', 'filtrado glomerular', 'glomerular filtration rate', 'egfr non-african american', 'egfr if non-african am'],
    system: 'kidney',
    riskProfile: 'linear-low',
    normalF: { min: 90, max: 200 },
    normalM: { min: 90, max: 200 },
    optimalF: { min: 100, max: 150 },
    optimalM: { min: 100, max: 150 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 4,
  },
  creatinine: {
    slug: 'creatinine',
    name: 'Creatinine',
    unit: 'mg/dL',
    aliases: ['creatinine', 'creatinina', 'creat', 's-creatinina', 'serum creatinine'],
    system: 'kidney',
    riskProfile: 'linear-high',
    normalF: { min: 0.5, max: 1.1 },
    normalM: { min: 0.6, max: 1.2 },
    optimalF: { min: 0.6, max: 0.9 },
    optimalM: { min: 0.7, max: 1.0 },
    impossibleMin: 0,
    impossibleMax: 30,
    priorityWeight: 3,
  },
  bun: {
    slug: 'bun',
    name: 'BUN',
    unit: 'mg/dL',
    aliases: ['bun', 'blood urea nitrogen', 'urea nitrogen', 'urea', 'nitrogeno ureico'],
    system: 'kidney',
    riskProfile: 'u-shaped',
    normalF: { min: 6, max: 20 },
    normalM: { min: 7, max: 20 },
    optimalF: { min: 8, max: 16 },
    optimalM: { min: 9, max: 18 },
    impossibleMin: 0,
    impossibleMax: 200,
    priorityWeight: 2,
  },

  // ===== ELECTROLYTES =====
  sodium: {
    slug: 'sodium',
    name: 'Sodium',
    unit: 'mmol/L',
    aliases: ['sodium', 'sodio', 'na', 'na+', 'serum sodium'],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 136, max: 145 },
    normalM: { min: 136, max: 145 },
    optimalF: { min: 138, max: 142 },
    optimalM: { min: 138, max: 142 },
    impossibleMin: 100,
    impossibleMax: 180,
    priorityWeight: 3,
  },
  potassium: {
    slug: 'potassium',
    name: 'Potassium',
    unit: 'mmol/L',
    aliases: ['potassium', 'potasio', 'k', 'k+', 'serum potassium'],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 3.5, max: 5.0 },
    normalM: { min: 3.5, max: 5.0 },
    optimalF: { min: 3.8, max: 4.5 },
    optimalM: { min: 3.8, max: 4.5 },
    impossibleMin: 1,
    impossibleMax: 10,
    priorityWeight: 3,
  },
  chloride: {
    slug: 'chloride',
    name: 'Chloride',
    unit: 'mmol/L',
    aliases: ['chloride', 'cloruro', 'cl', 'cl-', 'serum chloride'],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 98, max: 106 },
    normalM: { min: 98, max: 106 },
    optimalF: { min: 100, max: 104 },
    optimalM: { min: 100, max: 104 },
    impossibleMin: 70,
    impossibleMax: 140,
    priorityWeight: 2,
  },
  co2: {
    slug: 'co2',
    name: 'CO2 (Bicarbonate)',
    unit: 'mmol/L',
    aliases: ['co2', 'carbon dioxide', 'carbon dioxide total', 'bicarbonate', 'hco3', 'co2 total', 'total co2'],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 20, max: 29 },
    normalM: { min: 20, max: 29 },
    optimalF: { min: 22, max: 27 },
    optimalM: { min: 22, max: 27 },
    impossibleMin: 5,
    impossibleMax: 50,
    priorityWeight: 2,
  },
  calcium: {
    slug: 'calcium',
    name: 'Calcium',
    unit: 'mg/dL',
    aliases: ['calcium', 'calcio', 'ca', 'serum calcium', 'total calcium'],
    system: 'electrolytes',
    riskProfile: 'u-shaped',
    normalF: { min: 8.5, max: 10.5 },
    normalM: { min: 8.5, max: 10.5 },
    optimalF: { min: 9.0, max: 10.0 },
    optimalM: { min: 9.0, max: 10.0 },
    impossibleMin: 4,
    impossibleMax: 18,
    priorityWeight: 3,
  },

  // ===== IRON =====
  ferritin: {
    slug: 'ferritin',
    name: 'Ferritin',
    unit: 'ng/mL',
    aliases: ['ferritin', 'ferritina', 'fer', 's-ferritine', 'serum ferritin'],
    system: 'iron',
    riskProfile: 'u-shaped',
    normalF: { min: 12, max: 150 },
    normalM: { min: 30, max: 400 },
    optimalF: { min: 50, max: 120 },
    optimalM: { min: 75, max: 200 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 5,
  },

  // ===== INFLAMMATION =====
  crp_hs: {
    slug: 'crp_hs',
    name: 'hs-CRP',
    unit: 'mg/L',
    aliases: ['crp', 'hs-crp', 'crp-hs', 'pcr', 'pcr-us', 'c reactive protein', 'proteina c reactiva', 'proteina c reactiva alta sensibilidad', 'high sensitivity crp', 'c-reactive protein'],
    system: 'inflammation',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 3.0 },
    normalM: { min: 0, max: 3.0 },
    optimalF: { min: 0, max: 1.0 },
    optimalM: { min: 0, max: 1.0 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 5,
  },

  // ===== NUTRIENTS =====
  vitamin_d: {
    slug: 'vitamin_d',
    name: 'Vitamin D',
    unit: 'ng/mL',
    aliases: ['vitamin d', 'vitamina d', '25-oh vitamin d', '25-hydroxyvitamin d', 'calcidiol', 'vit d3', '25-oh vitamina d', 'd3', 'cholecalciferol', 'vitamin d 25-hydroxy', 'vitamin d, 25-hydroxy'],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 30, max: 100 },
    normalM: { min: 30, max: 100 },
    optimalF: { min: 50, max: 80 },
    optimalM: { min: 50, max: 80 },
    impossibleMin: 0,
    impossibleMax: 300,
    priorityWeight: 4,
  },
  vitamin_b12: {
    slug: 'vitamin_b12',
    name: 'Vitamin B12',
    unit: 'pg/mL',
    aliases: ['vitamin b12', 'vitamina b12', 'b12', 'cobalamin', 'cyanocobalamin', 'cobalamina', 'vitamin b-12', 'b-12', 'vit b12', 'vit b-12'],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 200, max: 900 },
    normalM: { min: 200, max: 900 },
    optimalF: { min: 500, max: 800 },
    optimalM: { min: 500, max: 800 },
    impossibleMin: 0,
    impossibleMax: 5000,
    priorityWeight: 3,
  },
  folate: {
    slug: 'folate',
    name: 'Folate',
    unit: 'ng/mL',
    aliases: ['folate', 'folic acid', 'acido folico', 'folato'],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 3.0, max: 20.0 },
    normalM: { min: 3.0, max: 20.0 },
    optimalF: { min: 10.0, max: 20.0 },
    optimalM: { min: 10.0, max: 20.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 3,
  },
  magnesium: {
    slug: 'magnesium',
    name: 'Magnesium',
    unit: 'mg/dL',
    aliases: ['magnesium', 'magnesio', 'mg', 'magnesio serico', 'serum magnesium'],
    system: 'nutrients',
    riskProfile: 'linear-low',
    normalF: { min: 1.7, max: 2.2 },
    normalM: { min: 1.7, max: 2.2 },
    optimalF: { min: 2.0, max: 2.2 },
    optimalM: { min: 2.0, max: 2.2 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 3,
  },

  // ===== ADRENAL =====
  cortisol_am: {
    slug: 'cortisol_am',
    name: 'Cortisol AM',
    unit: 'µg/dL',
    aliases: ['cortisol', 'cortisol am', 'cortisol matutino', 's-cortisol', 'morning cortisol', 'serum cortisol'],
    system: 'adrenal',
    riskProfile: 'u-shaped',
    normalF: { min: 6.0, max: 18.0 },
    normalM: { min: 6.0, max: 18.0 },
    optimalF: { min: 8.0, max: 15.0 },
    optimalM: { min: 8.0, max: 15.0 },
    impossibleMin: 0,
    impossibleMax: 80,
    priorityWeight: 4,
  },
  dhea_s: {
    slug: 'dhea_s',
    name: 'DHEA-S',
    unit: 'µg/dL',
    aliases: ['dhea-s', 'dhea sulfate', 'dheas', 'dehidroepiandrosterona', 'dhea'],
    system: 'adrenal',
    riskProfile: 'linear-low',
    normalF: { min: 35, max: 430 },
    normalM: { min: 80, max: 560 },
    optimalF: { min: 150, max: 350 },
    optimalM: { min: 250, max: 450 },
    impossibleMin: 0,
    impossibleMax: 1500,
    priorityWeight: 3,
  },

  // ===== HORMONES =====
  testosterone_total: {
    slug: 'testosterone_total',
    name: 'Total Testosterone',
    unit: 'ng/dL',
    aliases: ['testosterone', 'testosterona', 'testosterone total', 'testosterona total', 'testo t', 'total testosterone'],
    system: 'hormones',
    riskProfile: 'linear-low',
    normalF: { min: 8, max: 60 },
    normalM: { min: 264, max: 916 },
    optimalF: { min: 20, max: 50 },
    optimalM: { min: 500, max: 800 },
    impossibleMin: 0,
    impossibleMax: 3000,
    priorityWeight: 4,
  },

  // ===== BLOOD / CBC =====
  hemoglobin: {
    slug: 'hemoglobin',
    name: 'Hemoglobin',
    unit: 'g/dL',
    aliases: ['hemoglobin', 'hemoglobina', 'hgb', 'hb'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 12.0, max: 16.0 },
    normalM: { min: 13.5, max: 17.5 },
    optimalF: { min: 13.0, max: 15.0 },
    optimalM: { min: 14.5, max: 16.5 },
    impossibleMin: 2,
    impossibleMax: 25,
    priorityWeight: 4,
  },
  hematocrit: {
    slug: 'hematocrit',
    name: 'Hematocrit',
    unit: '%',
    aliases: ['hematocrit', 'hematocrito', 'hct'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 36, max: 46 },
    normalM: { min: 38, max: 50 },
    optimalF: { min: 38, max: 44 },
    optimalM: { min: 40, max: 48 },
    impossibleMin: 10,
    impossibleMax: 70,
    priorityWeight: 3,
  },
  rbc: {
    slug: 'rbc',
    name: 'Red Blood Cells',
    unit: 'M/µL',
    aliases: ['rbc', 'red blood cells', 'red blood cell count', 'eritrocitos', 'globulos rojos', 'red cell count'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 3.9, max: 5.0 },
    normalM: { min: 4.3, max: 5.7 },
    optimalF: { min: 4.1, max: 4.8 },
    optimalM: { min: 4.5, max: 5.3 },
    impossibleMin: 1,
    impossibleMax: 10,
    priorityWeight: 3,
  },
  mcv: {
    slug: 'mcv',
    name: 'MCV',
    unit: 'fL',
    aliases: ['mcv', 'mean corpuscular volume', 'volumen corpuscular medio'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 80, max: 100 },
    normalM: { min: 80, max: 100 },
    optimalF: { min: 82, max: 95 },
    optimalM: { min: 82, max: 95 },
    impossibleMin: 40,
    impossibleMax: 150,
    priorityWeight: 2,
  },
  mch: {
    slug: 'mch',
    name: 'MCH',
    unit: 'pg',
    aliases: ['mch', 'mean corpuscular hemoglobin'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 27, max: 33 },
    normalM: { min: 27, max: 33 },
    optimalF: { min: 28, max: 32 },
    optimalM: { min: 28, max: 32 },
    impossibleMin: 10,
    impossibleMax: 50,
    priorityWeight: 1,
  },
  mchc: {
    slug: 'mchc',
    name: 'MCHC',
    unit: 'g/dL',
    aliases: ['mchc', 'mean corpuscular hemoglobin concentration'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 31, max: 37 },
    normalM: { min: 31, max: 37 },
    optimalF: { min: 33, max: 36 },
    optimalM: { min: 33, max: 36 },
    impossibleMin: 20,
    impossibleMax: 45,
    priorityWeight: 1,
  },
  rdw: {
    slug: 'rdw',
    name: 'RDW',
    unit: '%',
    aliases: ['rdw', 'red cell distribution width', 'rdw-cv'],
    system: 'blood',
    riskProfile: 'linear-high',
    normalF: { min: 11.5, max: 14.5 },
    normalM: { min: 11.5, max: 14.5 },
    optimalF: { min: 11.5, max: 13.0 },
    optimalM: { min: 11.5, max: 13.0 },
    impossibleMin: 5,
    impossibleMax: 30,
    priorityWeight: 2,
  },
  mpv: {
    slug: 'mpv',
    name: 'MPV',
    unit: 'fL',
    aliases: ['mpv', 'mean platelet volume', 'volumen plaquetario medio'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 7.5, max: 11.5 },
    normalM: { min: 7.5, max: 11.5 },
    optimalF: { min: 8.0, max: 10.5 },
    optimalM: { min: 8.0, max: 10.5 },
    impossibleMin: 3,
    impossibleMax: 20,
    priorityWeight: 1,
  },
  platelets: {
    slug: 'platelets',
    name: 'Platelets',
    unit: 'K/µL',
    aliases: ['platelets', 'plaquetas', 'platelet count', 'trombocitos', 'plt'],
    system: 'blood',
    riskProfile: 'u-shaped',
    normalF: { min: 150, max: 400 },
    normalM: { min: 150, max: 400 },
    optimalF: { min: 200, max: 350 },
    optimalM: { min: 200, max: 350 },
    impossibleMin: 10,
    impossibleMax: 1500,
    priorityWeight: 3,
  },

  // ===== IMMUNE / WBC =====
  wbc: {
    slug: 'wbc',
    name: 'White Blood Cells',
    unit: 'K/µL',
    aliases: ['wbc', 'white blood cells', 'leucocitos', 'globulos blancos', 'white blood cell count', 'leucocyte count'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 4.5, max: 11.0 },
    normalM: { min: 4.5, max: 11.0 },
    optimalF: { min: 5.0, max: 8.0 },
    optimalM: { min: 5.0, max: 8.0 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 3,
  },
  neutrophils_pct: {
    slug: 'neutrophils_pct',
    name: 'Neutrophils',
    unit: '%',
    aliases: ['neutrophils', 'neutrofilos', 'neut', 'neut %', 'neutrophils %'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 40, max: 70 },
    normalM: { min: 40, max: 70 },
    optimalF: { min: 45, max: 65 },
    optimalM: { min: 45, max: 65 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 2,
  },
  lymphocytes_pct: {
    slug: 'lymphocytes_pct',
    name: 'Lymphocytes',
    unit: '%',
    aliases: ['lymphocytes', 'linfocitos', 'lymph', 'lymph %', 'lymphocytes %'],
    system: 'immune',
    riskProfile: 'u-shaped',
    normalF: { min: 20, max: 40 },
    normalM: { min: 20, max: 40 },
    optimalF: { min: 25, max: 35 },
    optimalM: { min: 25, max: 35 },
    impossibleMin: 0,
    impossibleMax: 100,
    priorityWeight: 2,
  },
  monocytes_pct: {
    slug: 'monocytes_pct',
    name: 'Monocytes',
    unit: '%',
    aliases: ['monocytes', 'monocitos', 'mono', 'mono %', 'monocytes %'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 2, max: 8 },
    normalM: { min: 2, max: 8 },
    optimalF: { min: 3, max: 7 },
    optimalM: { min: 3, max: 7 },
    impossibleMin: 0,
    impossibleMax: 50,
    priorityWeight: 1,
  },
  eosinophils_pct: {
    slug: 'eosinophils_pct',
    name: 'Eosinophils',
    unit: '%',
    aliases: ['eosinophils', 'eosinofilos', 'eos', 'eos %', 'eosinophils %'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 5 },
    normalM: { min: 0, max: 5 },
    optimalF: { min: 1, max: 4 },
    optimalM: { min: 1, max: 4 },
    impossibleMin: 0,
    impossibleMax: 30,
    priorityWeight: 1,
  },
  basophils_pct: {
    slug: 'basophils_pct',
    name: 'Basophils',
    unit: '%',
    aliases: ['basophils', 'basofilos', 'baso', 'baso %', 'basophils %'],
    system: 'immune',
    riskProfile: 'linear-high',
    normalF: { min: 0, max: 1 },
    normalM: { min: 0, max: 1 },
    optimalF: { min: 0, max: 0.5 },
    optimalM: { min: 0, max: 0.5 },
    impossibleMin: 0,
    impossibleMax: 10,
    priorityWeight: 1,
  },
}

// Unit conversion table
export const UNIT_CONVERSIONS: Record<string, { from: string; to: string; multiply: number }[]> = {
  crp_hs: [
    { from: 'mg/dL', to: 'mg/L', multiply: 10 },
  ],
  glucose_fasting: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 18.018 },
  ],
  vitamin_d: [
    { from: 'nmol/L', to: 'ng/mL', multiply: 0.4 },
  ],
  hemoglobin: [
    { from: 'mmol/L', to: 'g/dL', multiply: 1.6114 },
  ],
  creatinine: [
    { from: 'µmol/L', to: 'mg/dL', multiply: 0.0113 },
  ],
  testosterone_total: [
    { from: 'nmol/L', to: 'ng/dL', multiply: 28.818 },
  ],
  triglycerides: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 88.57 },
  ],
  hdl: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 38.67 },
  ],
  ldl: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 38.67 },
  ],
  total_cholesterol: [
    { from: 'mmol/L', to: 'mg/dL', multiply: 38.67 },
  ],
}

// Build a reverse lookup: alias → slug
const _aliasMap = new Map<string, string>()
for (const [slug, marker] of Object.entries(CANONICAL_DICTIONARY)) {
  for (const alias of marker.aliases) {
    _aliasMap.set(alias.toLowerCase().trim(), slug)
  }
}

/**
 * Fuzzy match a raw marker name from OCR to canonical slug.
 * Improved: handles hyphens, extra spaces, common lab formatting
 */
export function matchMarkerToSlug(rawName: string): string | null {
  const normalized = rawName.toLowerCase().trim()
    .replace(/[()]/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')

  // Direct match
  if (_aliasMap.has(normalized)) {
    return _aliasMap.get(normalized)!
  }

  // Normalize hyphens: "vitamin b-12" → "vitamin b12" and also keep hyphenated version
  const withoutHyphens = normalized.replace(/-/g, '')
  if (_aliasMap.has(withoutHyphens)) {
    return _aliasMap.get(withoutHyphens)!
  }

  // With hyphens replaced by spaces
  const hyphensToSpaces = normalized.replace(/-/g, ' ')
  if (_aliasMap.has(hyphensToSpaces)) {
    return _aliasMap.get(hyphensToSpaces)!
  }

  // Partial match: check if any alias is contained in the raw name or vice versa
  for (const [alias, slug] of _aliasMap.entries()) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return slug
    }
  }

  // Try without hyphens in partial match
  for (const [alias, slug] of _aliasMap.entries()) {
    if (withoutHyphens.includes(alias.replace(/-/g, '')) || alias.replace(/-/g, '').includes(withoutHyphens)) {
      return slug
    }
  }

  return null
}

/**
 * Convert a value from a non-canonical unit to the canonical unit.
 */
export function convertToCanonicalUnit(
  slug: string,
  value: number,
  reportedUnit: string
): { value: number; unit: string; converted: boolean } {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return { value, unit: reportedUnit, converted: false }

  const normalizedReported = reportedUnit.toLowerCase().trim()
  const normalizedCanonical = marker.unit.toLowerCase().trim()

  if (normalizedReported === normalizedCanonical) {
    return { value, unit: marker.unit, converted: false }
  }

  const conversions = UNIT_CONVERSIONS[slug]
  if (!conversions) return { value, unit: reportedUnit, converted: false }

  for (const conv of conversions) {
    if (conv.from.toLowerCase() === normalizedReported) {
      return {
        value: Math.round(value * conv.multiply * 100) / 100,
        unit: marker.unit,
        converted: true,
      }
    }
  }

  return { value, unit: reportedUnit, converted: false }
}

/**
 * Check if a value is physically impossible for a given marker.
 */
export function isImpossibleValue(slug: string, value: number): boolean {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return false
  return value < marker.impossibleMin || value > marker.impossibleMax
}

/**
 * Determine the state for a biomarker value.
 */
export function classifyBiomarkerState(
  slug: string,
  value: number,
  biologicalProfile: 'female' | 'male'
): 'Optimal' | 'Watch' | 'Attention' | 'Critical' {
  const marker = CANONICAL_DICTIONARY[slug]
  if (!marker) return 'Watch'

  const optimal = biologicalProfile === 'female' ? marker.optimalF : marker.optimalM
  const normal = biologicalProfile === 'female' ? marker.normalF : marker.normalM

  if (value >= optimal.min && value <= optimal.max) return 'Optimal'
  if (value >= normal.min && value <= normal.max) return 'Watch'

  const distFromNormal = value < normal.min
    ? (normal.min - value) / normal.min
    : (value - normal.max) / normal.max

  if (distFromNormal > 0.5) return 'Critical'
  return 'Attention'
}
