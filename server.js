const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const AdaptiveSampler = require('./adaptive_sampler');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'slag_simulation.db');

const sampler = new AdaptiveSampler({
  minInterval: 100,
  maxInterval: 5000,
  baseInterval: 1000,
  varianceThreshold: 0.1,
  rapidChangeThreshold: 0.3
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.access(req, res, duration);
  });
  next();
});

let db;

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    return new Uint8Array(fileBuffer);
  }
  return null;
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  const existingData = loadDatabase();
  if (existingData) {
    db = new SQL.Database(existingData);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS operation_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      slag_temperature REAL NOT NULL,
      water_flow REAL NOT NULL,
      slag_mass_flow REAL NOT NULL,
      slag_initial_temp REAL NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS heat_recovery_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      slag_temp REAL NOT NULL,
      steam_production REAL NOT NULL,
      heat_recovery_rate REAL NOT NULL,
      water_evaporated REAL NOT NULL,
      energy_recovered REAL NOT NULL,
      steam_temperature REAL DEFAULT 100,
      superheated_steam REAL DEFAULT 0,
      radiative_loss REAL DEFAULT 0,
      convective_loss REAL DEFAULT 0,
      slag_water_ratio REAL DEFAULT 0,
      exergy_efficiency REAL DEFAULT 0,
      total_energy REAL DEFAULT 0,
      slag_mass_flow_snap REAL DEFAULT 0,
      water_flow_snap REAL DEFAULT 0,
      slag_initial_temp_snap REAL DEFAULT 1450,
      heat_balance REAL DEFAULT 0,
      energy_utilization REAL DEFAULT 0,
      effective_efficiency REAL DEFAULT 0,
      slag_emissivity REAL DEFAULT 0.85,
      flow_efficiency_factor REAL DEFAULT 1.0,
      slag_composition TEXT DEFAULT NULL
    );
  `);
  
  try {
    const cols = db.exec("PRAGMA table_info(heat_recovery_snapshots)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(c => c[1]);
      const newCols = [
        {name: 'steam_temperature', default: 100},
        {name: 'superheated_steam', default: 0},
        {name: 'radiative_loss', default: 0},
        {name: 'convective_loss', default: 0},
        {name: 'slag_water_ratio', default: 0},
        {name: 'exergy_efficiency', default: 0},
        {name: 'total_energy', default: 0},
        {name: 'slag_mass_flow_snap', default: 0},
        {name: 'water_flow_snap', default: 0},
        {name: 'slag_initial_temp_snap', default: 1450},
        {name: 'heat_balance', default: 0},
        {name: 'energy_utilization', default: 0},
        {name: 'effective_efficiency', default: 0},
        {name: 'slag_emissivity', default: 0.85},
        {name: 'flow_efficiency_factor', default: 1.0}
      ];
      
      newCols.forEach(col => {
        if (!colNames.includes(col.name)) {
          db.run(`ALTER TABLE heat_recovery_snapshots ADD COLUMN ${col.name} REAL DEFAULT ${col.default}`);
          logger.info('database', `添加列: ${col.name}`);
        }
      });
      
      const textCols = [
        {name: 'slag_composition', default: 'NULL'}
      ];
      textCols.forEach(col => {
        if (!colNames.includes(col.name)) {
          db.run(`ALTER TABLE heat_recovery_snapshots ADD COLUMN ${col.name} TEXT DEFAULT ${col.default}`);
          logger.info('database', `添加列: ${col.name}`);
        }
      });
    }
  } catch (e) {
    logger.warn('database', '更新表结构时注意', { error: e.message });
  }
  
  saveDatabase();
  logger.info('database', '数据库初始化完成');
}

app.post('/api/params', (req, res) => {
  const startTime = Date.now();
  const { slagTemperature, waterFlow, slagMassFlow, slagInitialTemp } = req.body;
  
  sampler.updateFlow(slagMassFlow);
  
  db.run(
    `INSERT INTO operation_params 
    (slag_temperature, water_flow, slag_mass_flow, slag_initial_temp)
    VALUES (?, ?, ?, ?)`,
    [slagTemperature, waterFlow, slagMassFlow, slagInitialTemp]
  );
  
  saveDatabase();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0][0] || 1;
  
  logger.info('params', '参数已保存', {
    id,
    slagTemperature,
    waterFlow,
    slagMassFlow,
    samplingInterval: sampler.currentInterval
  });
  
  logger.performance('saveParams', Date.now() - startTime);
  
  res.json({ 
    id, 
    message: '参数已保存',
    samplingInterval: sampler.currentInterval,
    samplerStatus: sampler.getStatus()
  });
});

app.post('/api/snapshot', (req, res) => {
  const startTime = Date.now();
  const { 
    slagTemp, steamProduction, heatRecoveryRate, waterEvaporated, energyRecovered,
    steamTemperature, superheatedSteam, radiativeLoss, convectiveLoss, slagWaterRatio,
    exergyEfficiency, totalEnergy, slagMassFlow, waterFlow, slagInitialTemp,
    effectiveEfficiency, slagEmissivity, flowEfficiencyFactor, slagComposition
  } = req.body;
  
  const heatBalance = energyRecovered + (radiativeLoss + convectiveLoss) * 0.001;
  const energyUtilization = energyRecovered / Math.max(heatBalance, 0.001) * 100;
  
  db.run(
    `INSERT INTO heat_recovery_snapshots 
    (slag_temp, steam_production, heat_recovery_rate, water_evaporated, energy_recovered,
     steam_temperature, superheated_steam, radiative_loss, convective_loss, 
     slag_water_ratio, exergy_efficiency, total_energy, slag_mass_flow_snap, 
     water_flow_snap, slag_initial_temp_snap, heat_balance, energy_utilization,
     effective_efficiency, slag_emissivity, flow_efficiency_factor, slag_composition)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slagTemp, steamProduction, heatRecoveryRate, waterEvaporated, energyRecovered,
      steamTemperature || 100, superheatedSteam || 0, radiativeLoss || 0, convectiveLoss || 0,
      slagWaterRatio || 0, exergyEfficiency || 0, totalEnergy || 0, slagMassFlow || 0,
      waterFlow || 0, slagInitialTemp || 1450, heatBalance, energyUtilization,
      effectiveEfficiency || 0, slagEmissivity || 0.85, flowEfficiencyFactor || 1.0,
      slagComposition || null
    ]
  );
  
  saveDatabase();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0]?.values[0][0] || 1;
  
  logger.info('snapshot', '快照已保存', {
    id,
    heatRecoveryRate,
    steamProduction,
    effectiveEfficiency,
    heatBalance
  });
  
  logger.performance('saveSnapshot', Date.now() - startTime);
  
  res.json({ 
    id, 
    message: '快照已保存',
    heatBalance,
    energyUtilization
  });
});

app.get('/api/params', (req, res) => {
  const startTime = Date.now();
  const result = db.exec('SELECT * FROM operation_params ORDER BY timestamp DESC LIMIT 50');
  const rows = result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    timestamp: row[1],
    slag_temperature: row[2],
    water_flow: row[3],
    slag_mass_flow: row[4],
    slag_initial_temp: row[5]
  })) : [];
  
  logger.performance('getParams', Date.now() - startTime, { count: rows.length });
  res.json(rows);
});

app.get('/api/snapshots', (req, res) => {
  const startTime = Date.now();
  const result = db.exec('SELECT * FROM heat_recovery_snapshots ORDER BY timestamp DESC LIMIT 50');
  const rows = result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    timestamp: row[1],
    slag_temp: row[2],
    steam_production: row[3],
    heat_recovery_rate: row[4],
    water_evaporated: row[5],
    energy_recovered: row[6],
    steam_temperature: row[7] || 100,
    superheated_steam: row[8] || 0,
    radiative_loss: row[9] || 0,
    convective_loss: row[10] || 0,
    slag_water_ratio: row[11] || 0,
    exergy_efficiency: row[12] || 0,
    total_energy: row[13] || 0,
    slag_mass_flow_snap: row[14] || 0,
    water_flow_snap: row[15] || 0,
    slag_initial_temp_snap: row[16] || 1450,
    heat_balance: row[17] || 0,
    energy_utilization: row[18] || 0,
    effective_efficiency: row[19] || 0,
    slag_emissivity: row[20] || 0.85,
    flow_efficiency_factor: row[21] || 1.0,
    slag_composition: row[22] || null
  })) : [];
  
  logger.performance('getSnapshots', Date.now() - startTime, { count: rows.length });
  res.json(rows);
});

app.get('/api/summary', (req, res) => {
  const startTime = Date.now();
  const paramsResult = db.exec('SELECT * FROM operation_params ORDER BY timestamp DESC LIMIT 1');
  const snapshotsResult = db.exec('SELECT * FROM heat_recovery_snapshots ORDER BY timestamp DESC');
  
  const params = paramsResult.length > 0 ? {
    id: paramsResult[0].values[0][0],
    timestamp: paramsResult[0].values[0][1],
    slag_temperature: paramsResult[0].values[0][2],
    water_flow: paramsResult[0].values[0][3],
    slag_mass_flow: paramsResult[0].values[0][4],
    slag_initial_temp: paramsResult[0].values[0][5]
  } : null;
  
  const snapshots = snapshotsResult.length > 0 ? snapshotsResult[0].values.map(row => ({
    id: row[0],
    timestamp: row[1],
    slag_temp: row[2],
    steam_production: row[3],
    heat_recovery_rate: row[4],
    water_evaporated: row[5],
    energy_recovered: row[6]
  })) : [];
  
  let totalEnergy = 0;
  let totalSteam = 0;
  let totalEffectiveEfficiency = 0;
  snapshots.forEach((s, i) => {
    totalEnergy += s.energy_recovered;
    totalSteam += s.steam_production;
    if (snapshotsResult[0].values[i][19]) {
      totalEffectiveEfficiency += snapshotsResult[0].values[i][19];
    }
  });
  
  const avgEfficiency = snapshots.length > 0 ? totalEffectiveEfficiency / snapshots.length : 0;
  
  logger.performance('getSummary', Date.now() - startTime);
  
  res.json({
    latestParams: params,
    totalSnapshots: snapshots.length,
    totalEnergyRecovered: totalEnergy,
    totalSteamProduced: totalSteam,
    averageEffectiveEfficiency: avgEfficiency,
    samplerStatus: sampler.getStatus()
  });
});

app.get('/api/sampler-status', (req, res) => {
  res.json({
    samplerStatus: sampler.getStatus(),
    config: {
      minInterval: sampler.minInterval,
      maxInterval: sampler.maxInterval,
      baseInterval: sampler.baseInterval,
      varianceThreshold: sampler.varianceThreshold,
      rapidChangeThreshold: sampler.rapidChangeThreshold
    }
  });
});

app.get('/api/logs', (req, res) => {
  const { type = 'app', lines = 100 } = req.query;
  const logFile = path.join(__dirname, 'logs', `${type}-${getDateString()}.log`);
  
  try {
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf-8');
      const logLines = content.split('\n').filter(line => line.trim()).slice(-lines);
      res.json({
        type,
        count: logLines.length,
        logs: logLines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        })
      });
    } else {
      res.json({ type, count: 0, logs: [], message: '日志文件不存在' });
    }
  } catch (e) {
    logger.error('logs', '读取日志失败', { error: e.message });
    res.status(500).json({ error: '读取日志失败' });
  }
});

function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info('server', `高炉渣粒化余热回收模拟系统已启动: http://localhost:${PORT}`);
    console.log(`高炉渣粒化余热回收模拟系统已启动: http://localhost:${PORT}`);
  });
}).catch(err => {
  logger.error('database', '数据库初始化失败', { error: err.message });
  console.error('数据库初始化失败:', err);
});

process.on('SIGTERM', () => {
  logger.info('server', '收到SIGTERM信号，正在关闭...');
  logger.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('server', '收到SIGINT信号，正在关闭...');
  logger.close();
  process.exit(0);
});
