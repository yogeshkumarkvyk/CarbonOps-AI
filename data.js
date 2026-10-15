/* CarbonOps AI — reference data and fictional seed data.
   Everything in this file that describes a factory is FICTIONAL demo data. */
(function (G) {
  'use strict';

  // ---------- Months in the demo dataset (Indian FY: Apr–Mar) ----------
  const MONTHS = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(2025, 3 + i, 1));
    MONTHS.push(d.toISOString().slice(0, 7));
  }
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthLabel(m, long) {
    const [y, mo] = m.split('-').map(Number);
    return MONTH_NAMES[mo - 1] + (long ? ' ' + y : ' ' + String(y).slice(2));
  }

  // ---------- Emission factor registry ----------
  // kgPer = kg CO2e per activity unit. value/unit are shown as published.
  // quality: documented | derived | illustrative | missing
  const FACTORS = [
    {
      id: 'grid-in', name: 'Grid electricity, India (location-based)', scope: 2,
      activityUnit: 'kWh', unit: 't CO2/MWh', value: 0.727, kgPer: 0.727,
      source: 'Central Electricity Authority, CO2 Baseline Database: weighted average emission factor adjusted for RE, FY 2023-24',
      year: 2024, region: 'India (all-India grid)', method: 'Location-based', validity: 'FY 2023-24', quality: 'documented',
      note: 'CEA has published a newer release (User Guide v22.0, Sep 2026). Check the latest figure and add it as a new version before reporting.'
    },
    {
      id: 'diesel', name: 'Diesel (gas/diesel oil), stationary combustion', scope: 1,
      activityUnit: 'L', unit: 'kg CO2/L', value: 2.651, kgPer: 2.651,
      source: 'Derived from IPCC 2006 Guidelines Vol. 2 defaults: 74,100 kg CO2/TJ × NCV 43.0 TJ/Gg × density 0.832 kg/L',
      year: 2006, region: 'Default (global)', method: 'Fuel-based, CO2 only', validity: 'Until supplier NCV available', quality: 'derived',
      note: 'CH4 and N2O are excluded (typically <1% of CO2e). Replace density and NCV with supplier test certificates where available.'
    },
    {
      id: 'lpg', name: 'LPG, stationary combustion', scope: 1,
      activityUnit: 'kg', unit: 'kg CO2/kg', value: 2.985, kgPer: 2.985,
      source: 'Derived from IPCC 2006 Guidelines Vol. 2 defaults: 63,100 kg CO2/TJ × NCV 47.3 TJ/Gg',
      year: 2006, region: 'Default (global)', method: 'Fuel-based, CO2 only', validity: 'Until supplier NCV available', quality: 'derived',
      note: 'CH4 and N2O excluded.'
    },
    {
      id: 'petrol', name: 'Petrol (motor gasoline), mobile combustion', scope: 1,
      activityUnit: 'L', unit: 'kg CO2/L', value: 2.287, kgPer: 2.287,
      source: 'Derived from IPCC 2006 Guidelines defaults: 69,300 kg CO2/TJ × NCV 44.3 TJ/Gg × density 0.745 kg/L',
      year: 2006, region: 'Default (global)', method: 'Fuel-based, CO2 only', validity: 'Until supplier NCV available', quality: 'derived', note: ''
    },
    {
      id: 'natgas', name: 'Natural gas, stationary combustion', scope: 1,
      activityUnit: 'GJ', unit: 'kg CO2/GJ', value: 56.1, kgPer: 56.1,
      source: 'IPCC 2006 Guidelines Vol. 2, Table 2.2 default: 56,100 kg CO2/TJ',
      year: 2006, region: 'Default (global)', method: 'Energy-based (NCV), CO2 only', validity: 'Until supplier data available', quality: 'documented',
      note: 'Activity must be in GJ (net calorific value). Convert SCM using the supplier GCV/NCV.'
    },
    {
      id: 'r410a', name: 'Refrigerant R-410A, fugitive release', scope: 1,
      activityUnit: 'kg', unit: 'kg CO2e/kg (GWP100)', value: 1924, kgPer: 1924,
      source: 'IPCC Fifth Assessment Report (AR5), 100-year GWP of R-410A blend',
      year: 2014, region: 'Global', method: 'Mass balance (top-up quantity = leakage)', validity: 'AR5 basis', quality: 'documented',
      note: 'Choose AR5 or AR6 GWPs consistently across the inventory.'
    },
    {
      id: 'steel', name: 'Purchased steel bar and coil (cradle-to-gate)', scope: 3,
      activityUnit: 't', unit: 't CO2e/t', value: 1.9, kgPer: 1900,
      source: 'Illustrative placeholder of the order of global industry averages. Not an official factor.',
      year: 2024, region: 'Global average (placeholder)', method: 'Average-data method', validity: 'Demo only', quality: 'illustrative',
      note: 'Replace with supplier-specific EPD values. Primary vs scrap-based routes differ several-fold.'
    },
    {
      id: 'aluminium', name: 'Purchased aluminium ingot', scope: 3,
      activityUnit: 't', unit: 't CO2e/t', value: null, kgPer: null,
      source: 'No validated factor on file', year: null, region: '—', method: 'Average-data method', validity: '—', quality: 'missing',
      note: 'Aluminium factors vary widely with smelter electricity source. Request a supplier-specific value.'
    },
    {
      id: 'road', name: 'Road freight, articulated truck', scope: 3,
      activityUnit: 'tkm', unit: 'kg CO2e/tkm', value: 0.107, kgPer: 0.107,
      source: 'Illustrative placeholder of the order of published heavy-goods-vehicle averages. Not India-specific.',
      year: 2024, region: 'Placeholder', method: 'Distance-based', validity: 'Demo only', quality: 'illustrative',
      note: 'Prefer fuel-based calculation from carrier fuel data, or an India-specific factor.'
    },
    {
      id: 'rail', name: 'Rail freight', scope: 3,
      activityUnit: 'tkm', unit: 'kg CO2e/tkm', value: 0.028, kgPer: 0.028,
      source: 'Illustrative placeholder of the order of published rail freight averages. Not India-specific.',
      year: 2024, region: 'Placeholder', method: 'Distance-based', validity: 'Demo only', quality: 'illustrative', note: ''
    },
    {
      id: 'landfill', name: 'Mixed industrial waste to landfill', scope: 3,
      activityUnit: 't', unit: 't CO2e/t', value: 0.52, kgPer: 520,
      source: 'Illustrative placeholder. Landfill methane depends on waste composition and site gas capture.',
      year: 2024, region: 'Placeholder', method: 'Waste-type-specific', validity: 'Demo only', quality: 'illustrative', note: ''
    },
    {
      id: 'recycling', name: 'Metal scrap sent for recycling', scope: 3,
      activityUnit: 't', unit: 't CO2e/t', value: 0.021, kgPer: 21,
      source: 'Illustrative placeholder covering collection and processing only.',
      year: 2024, region: 'Placeholder', method: 'Waste-type-specific', validity: 'Demo only', quality: 'illustrative', note: ''
    }
  ];

  // ---------- Activity categories ----------
  const CATEGORIES = {
    electricity: { label: 'Grid electricity', scope: 2, factor: 'grid-in', unit: 'kWh', units: { kWh: 1, MWh: 1000 }, color: 'c1', s3cat: null, energy: true },
    diesel: { label: 'Diesel', scope: 1, factor: 'diesel', unit: 'L', units: { L: 1, kL: 1000 }, color: 'c2', s3cat: null, energy: true },
    lpg: { label: 'LPG', scope: 1, factor: 'lpg', unit: 'kg', units: { kg: 1, t: 1000 }, color: 'c3', s3cat: null, energy: true },
    petrol: { label: 'Petrol', scope: 1, factor: 'petrol', unit: 'L', units: { L: 1, kL: 1000 }, color: 'c2', s3cat: null, energy: true },
    natural_gas: { label: 'Natural gas', scope: 1, factor: 'natgas', unit: 'GJ', units: { GJ: 1, MJ: 0.001 }, color: 'c3', s3cat: null, energy: true },
    refrigerant: { label: 'Refrigerant (R-410A)', scope: 1, factor: 'r410a', unit: 'kg', units: { kg: 1, g: 0.001 }, color: 'c4', s3cat: null },
    steel: { label: 'Purchased steel', scope: 3, factor: 'steel', unit: 't', units: { t: 1, kg: 0.001 }, color: 'c5', s3cat: 1 },
    aluminium: { label: 'Purchased aluminium', scope: 3, factor: 'aluminium', unit: 't', units: { t: 1, kg: 0.001 }, color: 'c6', s3cat: 1 },
    freight_road: { label: 'Road freight', scope: 3, factor: 'road', unit: 'tkm', units: { tkm: 1 }, color: 'c7', s3cat: 4 },
    freight_rail: { label: 'Rail freight', scope: 3, factor: 'rail', unit: 'tkm', units: { tkm: 1 }, color: 'c7', s3cat: 4 },
    waste_landfill: { label: 'Waste to landfill', scope: 3, factor: 'landfill', unit: 't', units: { t: 1, kg: 0.001 }, color: 'c8', s3cat: 5 },
    waste_recycling: { label: 'Scrap to recycling', scope: 3, factor: 'recycling', unit: 't', units: { t: 1, kg: 0.001 }, color: 'c8', s3cat: 5 },
    production: { label: 'Production output', scope: null, factor: null, unit: 'units', units: { units: 1, pcs: 1 }, color: 'c1', s3cat: null }
  };

  const S3_CATS = {
    1: 'Cat. 1 Purchased goods', 4: 'Cat. 4 Upstream transport', 5: 'Cat. 5 Waste in operations', 9: 'Cat. 9 Downstream transport'
  };

  // ---------- Factory areas (digital twin geometry in iso grid units) ----------
  const AREAS = [
    { id: 'lineA', name: 'Production Line A', kind: 'Process', equipment: '8 CNC turning centres, 4 vertical machining centres', hours: 20, days: 26, geo: [0, 0, 14, 8, 4] },
    { id: 'lineB', name: 'Production Line B', kind: 'Process', equipment: '3 power presses (250 t), 6 robotic MIG welding cells', hours: 16, days: 26, geo: [0, 10, 14, 7, 4] },
    { id: 'compressor', name: 'Compressor house', kind: 'Utility', equipment: '2 × 75 kW screw compressors, 1 refrigerated dryer', hours: 22, days: 26, geo: [16, 0, 5, 4, 3] },
    { id: 'boiler', name: 'Boiler and heat treatment', kind: 'Thermal', equipment: 'LPG-fired thermic fluid heater, 2 tempering furnaces', hours: 18, days: 26, geo: [16, 6, 5, 5, 4], stack: true },
    { id: 'cooling', name: 'Refrigeration and cooling', kind: 'Utility', equipment: '2 × 120 TR chillers (R-410A), cooling tower, CHW pumps', hours: 24, days: 30, geo: [16, 13, 5, 4, 2.5] },
    { id: 'dg', name: 'Diesel generators', kind: 'Utility', equipment: '2 × 750 kVA DG sets (standby)', hours: 3, days: 30, geo: [23, 0, 5, 5, 2], stack: true },
    { id: 'storage', name: 'Material storage', kind: 'Storage', equipment: 'Steel bar racks, aluminium ingot bay, 10 t gantry crane', hours: 16, days: 26, geo: [23, 7, 6, 6, 3] },
    { id: 'warehouse', name: 'Finished goods warehouse', kind: 'Storage', equipment: 'Racking, 4 electric forklifts, high-bay lighting', hours: 20, days: 26, geo: [0, 19, 14, 6, 5] },
    { id: 'waste', name: 'Waste handling', kind: 'Support', equipment: 'Scrap baler, segregation bays, hazardous waste store', hours: 10, days: 26, geo: [23, 15, 5, 4, 1.5] },
    { id: 'logistics', name: 'Transport and logistics', kind: 'Logistics', equipment: 'Inbound and outbound truck docks (third-party carriers)', hours: 16, days: 26, geo: [16, 19, 12, 6, 0.6], trucks: true }
  ];

  // ---------- Seasonal profiles indexed by calendar month (1–12) ----------
  const SEASON = {
    flat: () => 1,
    prod: (mo) => ({ 10: 0.92, 11: 0.9, 3: 1.05 })[mo] || 1,
    cool: (mo) => ({ 4: 1.25, 5: 1.35, 6: 1.2, 7: 1.0, 8: 0.95, 9: 1.0, 10: 0.95, 11: 0.82, 12: 0.72, 1: 0.7, 2: 0.8, 3: 1.05 })[mo],
    dg: (mo) => ({ 6: 1.15, 7: 1.5, 8: 1.6, 9: 1.35 })[mo] || 0.85
  };

  // stream: base monthly quantity in category unit
  const STREAMS_F1 = [
    { stream: 'LA-EM-01', area: 'lineA', category: 'electricity', base: 208000, season: 'prod', status: 'imported', source: 'Sub-meter LA-EM-01, monthly log reconciled to utility bill', drift: (i) => (i >= 14 ? 1.085 : 1) },
    { stream: 'LB-EM-01', area: 'lineB', category: 'electricity', base: 162000, season: 'prod', status: 'imported', source: 'Sub-meter LB-EM-01, monthly log reconciled to utility bill' },
    { stream: 'CMP-EM-02', area: 'compressor', category: 'electricity', base: 91000, season: 'prod', status: 'imported', source: 'Sub-meter CMP-EM-02, monthly log', lastStatus: 'estimated' },
    { stream: 'BLR-EM-01', area: 'boiler', category: 'electricity', base: 9500, season: 'prod', status: 'imported', source: 'Sub-meter BLR-EM-01' },
    { stream: 'BLR-LPG', area: 'boiler', category: 'lpg', base: 37500, season: 'prod', status: 'imported', source: 'LPG supplier invoices (bulk tanker)' },
    { stream: 'CW-EM-01', area: 'cooling', category: 'electricity', base: 52000, season: 'cool', status: 'imported', source: 'Sub-meter CW-EM-01' },
    { stream: 'CW-REF', area: 'cooling', category: 'refrigerant', base: 0, season: 'flat', status: 'estimated', source: 'Chiller service log, refrigerant top-up quantity', special: { 2: 6.5, 13: 5.0, 17: 4.0 } },
    { stream: 'DG-FM-01', area: 'dg', category: 'diesel', base: 7600, season: 'dg', status: 'measured', source: 'DG day-tank flow meter DG-FM-01', skip: [16] },
    { stream: 'WH-EM-01', area: 'warehouse', category: 'electricity', base: 18500, season: 'flat', status: 'imported', source: 'Sub-meter WH-EM-01', drift: (i) => (i >= 12 ? 0.765 : 1) },
    { stream: 'PO-STEEL', area: 'storage', category: 'steel', base: 405, season: 'prod', status: 'imported', source: 'ERP purchase orders, goods receipt' },
    { stream: 'PO-ALU', area: 'storage', category: 'aluminium', base: 31, season: 'prod', status: 'imported', source: 'ERP purchase orders, goods receipt' },
    { stream: 'WST-LF', area: 'waste', category: 'waste_landfill', base: 15.5, season: 'flat', status: 'imported', source: 'Waste transporter manifests' },
    { stream: 'WST-RC', area: 'waste', category: 'waste_recycling', base: 47, season: 'prod', status: 'imported', source: 'Scrap sale invoices (weighbridge)' },
    { stream: 'FRT-IN', area: 'logistics', category: 'freight_road', base: 152000, season: 'prod', status: 'estimated', source: 'Invoice tonnage × route-planner distance (inbound)', s3cat: 4 },
    { stream: 'FRT-OUT', area: 'logistics', category: 'freight_road', base: 231000, season: 'prod', status: 'estimated', source: 'Dispatch tonnage × route-planner distance (outbound)', s3cat: 9 },
    { stream: 'PRD-A', area: 'lineA', category: 'production', base: 104000, season: 'prod', status: 'measured', source: 'MES production counts, Line A' },
    { stream: 'PRD-B', area: 'lineB', category: 'production', base: 81000, season: 'prod', status: 'measured', source: 'MES production counts, Line B' }
  ];

  const FACTORIES = [
    {
      id: 'f1', name: 'Deccan Precision Components', short: 'Patancheru plant', location: 'Patancheru, Telangana, India',
      industry: 'Automotive components (machined and fabricated parts)', productionUnit: 'parts', seed: 7, scale: 1, streams: STREAMS_F1
    },
    {
      id: 'f2', name: 'Deccan Precision Components', short: 'Hosur Unit 2', location: 'Hosur, Tamil Nadu, India',
      industry: 'Automotive components (fabricated parts)', productionUnit: 'parts', seed: 21, scale: 0.48,
      streams: STREAMS_F1.filter((s) => !['DG-FM-01', 'PO-ALU', 'LA-EM-01', 'PRD-A', 'CW-REF'].includes(s.stream))
    }
  ];

  // ---------- Default tariffs and prices (illustrative assumptions, editable) ----------
  const DEFAULT_SETTINGS = {
    tariffs: {
      electricity: 8.2, diesel: 92, lpg: 78, petrol: 102, natural_gas: 950, refrigerant: 1200,
      steel: 62000, aluminium: 245000, freight_road: 3.2, freight_rail: 2.1, waste_landfill: 2800, waste_recycling: 0, scrapResale: 28000
    },
    boundary: { approach: 'Operational control', s3: { 1: true, 4: true, 5: true, 9: true } },
    target: { pct: 30, baseFY: 'FY 2025-26', targetFY: 'FY 2029-30', scope: 'Scope 1 + 2' },
    displayUnit: 't',
    user: { name: 'Demo user', role: 'Plant admin' }
  };

  // ---------- Seeded random ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function round(v, dp) { const p = Math.pow(10, dp); return Math.round(v * p) / p; }

  function seedRecords(factory) {
    const r = rng(factory.seed);
    const out = [];
    MONTHS.forEach((m, i) => {
      const mo = Number(m.slice(5));
      factory.streams.forEach((s) => {
        if (s.skip && s.skip.includes(i)) return;
        let qty;
        if (s.special) {
          if (!(i in s.special)) return;
          qty = s.special[i] * factory.scale;
        } else {
          const growth = 1 + 0.003 * i;
          const noise = 1 + (r() - 0.5) * 0.06;
          qty = s.base * factory.scale * SEASON[s.season](mo) * growth * noise * (s.drift ? s.drift(i) : 1);
        }
        const cat = CATEGORIES[s.category];
        const dp = cat.unit === 't' ? 2 : cat.unit === 'kg' && s.category === 'refrigerant' ? 1 : 0;
        const isLast = i === MONTHS.length - 1;
        out.push({
          id: factory.id + '-' + s.stream + '-' + m,
          month: m, area: s.area, category: s.category, stream: s.stream,
          qty: round(qty, dp), unit: cat.unit,
          origQty: round(qty, dp), origUnit: cat.unit,
          status: isLast && s.lastStatus ? s.lastStatus : s.status,
          source: isLast && s.lastStatus === 'estimated' ? 'Estimated from bill split (sub-meter reading not yet logged)' : s.source,
          s3cat: s.s3cat || cat.s3cat,
          origin: 'seed', history: []
        });
      });
    });
    return out;
  }

  // Sample CSV for the demo import (forklift / yard vehicle diesel), includes deliberate problems.
  const SAMPLE_IMPORT_CSV = [
    'date,area,category,quantity,unit,cost_inr,source_id,notes',
    '2026-04,Transport and logistics,diesel,1180,L,108560,YARD-DSL,Yard tractor and diesel forklifts - fuel log',
    '2026-05,Transport and logistics,diesel,1215,L,111780,YARD-DSL,Yard tractor and diesel forklifts - fuel log',
    '2026-06,Transport and logistics,diesel,1.162,kL,106904,YARD-DSL,Recorded in kilolitres by fuel vendor',
    '2026-07,Transport and logistics,diesel,1240,L,114080,YARD-DSL,Yard tractor and diesel forklifts - fuel log',
    '2026-07,Transport and logistics,diesel,1240,L,114080,YARD-DSL,Duplicate line from vendor statement',
    '2026-08,Transport and logistics,diesel,1198,kVAh,,YARD-DSL,Unit entered incorrectly',
    '2026-09,Transport and logistics,diesel,-40,L,,YARD-DSL,Credit note entered as negative fuel',
    '2026-09,Transport and logistics,diesel,1226,L,112792,YARD-DSL-2,Corrected September entry'
  ].join('\n');

  const TEMPLATES = {
    electricity: 'date,area,category,quantity,unit,cost_inr,source_id,notes\n2026-10,lineA,electricity,212000,kWh,1738400,LA-EM-01,Monthly sub-meter reading\n',
    fuel: 'date,area,category,quantity,unit,cost_inr,source_id,notes\n2026-10,dg,diesel,7900,L,726800,DG-FM-01,Day-tank flow meter\n2026-10,boiler,lpg,38.2,t,2979600,BLR-LPG,Supplier invoice\n',
    materials: 'date,area,category,quantity,unit,cost_inr,source_id,notes\n2026-10,storage,steel,410.5,t,25451000,PO-STEEL,Goods receipt\n2026-10,storage,aluminium,30.8,t,7546000,PO-ALU,Goods receipt\n',
    freight: 'date,area,category,tonnes,distance_km,quantity,unit,source_id,notes\n2026-10,logistics,freight_road,410,370,,tkm,FRT-IN,Leave quantity blank to compute tonnes × km\n',
    waste: 'date,area,category,quantity,unit,cost_inr,source_id,notes\n2026-10,waste,waste_landfill,15.2,t,42560,WST-LF,Transporter manifest\n2026-10,waste,waste_recycling,46.1,t,0,WST-RC,Scrap sale invoice\n',
    production: 'date,area,category,quantity,unit,source_id,notes\n2026-10,lineA,production,105200,units,PRD-A,MES count\n2026-10,lineB,production,82100,units,PRD-B,MES count\n'
  };

  // Meters known to the computer vision workflow
  const METERS = [
    { id: 'CMP-EM-02', label: 'CMP-EM-02 · Compressor house energy meter', area: 'compressor', category: 'electricity', unit: 'kWh', prev: 1284310.0, prevDate: '2026-08-31', mf: 1 },
    { id: 'LA-EM-01', label: 'LA-EM-01 · Line A energy meter', area: 'lineA', category: 'electricity', unit: 'kWh', prev: 3902115.4, prevDate: '2026-08-31', mf: 1 },
    { id: 'DG-FM-01', label: 'DG-FM-01 · DG day-tank fuel flow meter', area: 'dg', category: 'diesel', unit: 'L', prev: 286420, prevDate: '2026-08-31', mf: 1 }
  ];

  G.CO_DATA = { MONTHS, monthLabel, FACTORS, CATEGORIES, S3_CATS, AREAS, FACTORIES, DEFAULT_SETTINGS, seedRecords, rng, SAMPLE_IMPORT_CSV, TEMPLATES, METERS };
})(typeof window !== 'undefined' ? window : globalThis);
