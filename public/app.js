class SlagSimulation {
  constructor() {
    this.isRunning = false;
    this.animationId = null;
    
    this.params = {
      slagTemp: 1450,
      waterFlow: 150,
      slagMassFlow: 20,
      ambientTemp: 25,
      slagComposition: {
        CaO: 40,
        SiO2: 35,
        Al2O3: 12,
        MgO: 8
      }
    };
    
    this.state = {
      slagParticleTemp: 1450,
      steamProduction: 0,
      heatRecoveryRate: 0,
      waterEvaporated: 0,
      energyRecovered: 0,
      totalEnergy: 0,
      steamTemperature: 100,
      superheatedSteam: 0,
      radiativeLoss: 0,
      convectiveLoss: 0,
      slagWaterRatio: 0,
      heatTransferCoeff: 0,
      exergyEfficiency: 0,
      effectiveEfficiency: 0,
      slagEmissivity: 0.85,
      flowEfficiencyFactor: 1.0,
      heatBalance: {
        input: 0,
        recovered: 0,
        radiative: 0,
        convective: 0,
        slagSensible: 0,
        unaccounted: 0
      },
      time: 0
    };
    
    this.slagParticles = [];
    this.steamParticles = [];
    this.waterDroplets = [];
    
    this.heatCapacity = {
      slag: 1.2,
      water: 4.186,
      steam: 2.0
    };
    
    this.latentHeat = {
      vaporization: 2260
    };
    
    this.waterBoilingTemp = 100;
    this.stefanBoltzmann = 5.67e-8;
    
    this.canvasLayers = {};
    
    this.initEventListeners();
    this.setupCanvasLayers();
    this.animate();
  }
  
  setupCanvasLayers() {
    const container = document.getElementById('canvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const width = rect.width - 40;
    const height = 500;
    
    const layerConfigs = [
      { id: 'backgroundLayer', zIndex: 1 },
      { id: 'equipmentLayer', zIndex: 2 },
      { id: 'flowLayer', zIndex: 3 },
      { id: 'waterLayer', zIndex: 4 },
      { id: 'slagLayer', zIndex: 5 },
      { id: 'steamLayer', zIndex: 6 },
      { id: 'uiLayer', zIndex: 10 }
    ];
    
    layerConfigs.forEach(config => {
      const canvas = document.createElement('canvas');
      canvas.id = config.id;
      canvas.width = width;
      canvas.height = height;
      canvas.style.position = 'absolute';
      canvas.style.left = '20px';
      canvas.style.top = '20px';
      canvas.style.zIndex = config.zIndex;
      canvas.width = width;
      canvas.height = height;
      container.appendChild(canvas);
      
      this.canvasLayers[config.id] = {
        canvas,
        ctx: canvas.getContext('2d')
      };
    });
    
    window.addEventListener('resize', () => {
      const newRect = container.getBoundingClientRect();
      const newWidth = newRect.width - 40;
      const newHeight = 500;
      
      Object.values(this.canvasLayers).forEach(layer => {
        layer.canvas.width = newWidth;
        layer.canvas.height = newHeight;
      });
      
      this.renderStaticLayers();
    });
    
    this.renderStaticLayers();
  }
  
  renderStaticLayers() {
    this.drawBackground();
    this.drawEquipment();
  }
  
  initEventListeners() {
    document.getElementById('slagTemp').addEventListener('input', (e) => {
      this.params.slagTemp = parseFloat(e.target.value);
      document.getElementById('slagTempValue').textContent = e.target.value;
    });
    
    document.getElementById('waterFlow').addEventListener('input', (e) => {
      this.params.waterFlow = parseFloat(e.target.value);
      document.getElementById('waterFlowValue').textContent = e.target.value;
    });
    
    document.getElementById('slagMassFlow').addEventListener('input', (e) => {
      this.params.slagMassFlow = parseFloat(e.target.value);
      document.getElementById('slagMassFlowValue').textContent = e.target.value;
    });
    
    document.getElementById('ambientTemp').addEventListener('input', (e) => {
      this.params.ambientTemp = parseFloat(e.target.value);
      document.getElementById('ambientTempValue').textContent = e.target.value;
    });
    
    document.getElementById('caoContent').addEventListener('input', (e) => {
      this.params.slagComposition.CaO = parseFloat(e.target.value);
      document.getElementById('caoContentValue').textContent = e.target.value;
      this.updateSlagEmissivity();
    });
    
    document.getElementById('sio2Content').addEventListener('input', (e) => {
      this.params.slagComposition.SiO2 = parseFloat(e.target.value);
      document.getElementById('sio2ContentValue').textContent = e.target.value;
      this.updateSlagEmissivity();
    });
    
    document.getElementById('al2o3Content').addEventListener('input', (e) => {
      this.params.slagComposition.Al2O3 = parseFloat(e.target.value);
      document.getElementById('al2o3ContentValue').textContent = e.target.value;
      this.updateSlagEmissivity();
    });
    
    document.getElementById('mgoContent').addEventListener('input', (e) => {
      this.params.slagComposition.MgO = parseFloat(e.target.value);
      document.getElementById('mgoContentValue').textContent = e.target.value;
      this.updateSlagEmissivity();
    });
    
    document.getElementById('startBtn').addEventListener('click', () => this.start());
    document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
    document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    document.getElementById('saveBtn').addEventListener('click', () => this.saveSnapshot());
    
    document.getElementById('loadParamsBtn').addEventListener('click', () => this.loadParams());
    document.getElementById('loadSnapshotsBtn').addEventListener('click', () => this.loadSnapshots());
    
    this.updateSlagEmissivity();
  }
  
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.saveParams();
    }
  }
  
  pause() {
    this.isRunning = false;
  }
  
  reset() {
    this.isRunning = false;
    this.state = {
      slagParticleTemp: this.params.slagTemp,
      steamProduction: 0,
      heatRecoveryRate: 0,
      waterEvaporated: 0,
      energyRecovered: 0,
      totalEnergy: 0,
      steamTemperature: 100,
      superheatedSteam: 0,
      radiativeLoss: 0,
      convectiveLoss: 0,
      slagWaterRatio: 0,
      heatTransferCoeff: 0,
      exergyEfficiency: 0,
      effectiveEfficiency: 0,
      slagEmissivity: this.calculateSlagEmissivity(),
      flowEfficiencyFactor: 1.0,
      heatBalance: {
        input: 0,
        recovered: 0,
        radiative: 0,
        convective: 0,
        slagSensible: 0,
        unaccounted: 0
      },
      time: 0
    };
    this.slagParticles = [];
    this.steamParticles = [];
    this.waterDroplets = [];
    this.clearDynamicLayers();
    this.updateDisplay();
  }
  
  clearDynamicLayers() {
    ['flowLayer', 'waterLayer', 'slagLayer', 'steamLayer', 'uiLayer'].forEach(layerId => {
      const layer = this.canvasLayers[layerId];
      if (layer) {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      }
    });
  }
  
  calculateSlagEmissivity() {
    const { CaO, SiO2, Al2O3, MgO } = this.params.slagComposition;
    const total = CaO + SiO2 + Al2O3 + MgO;
    const caoRatio = CaO / total;
    const sio2Ratio = SiO2 / total;
    const al2o3Ratio = Al2O3 / total;
    const mgoRatio = MgO / total;
    
    const baseEmissivity = 0.70;
    const caoEffect = caoRatio * 0.05;
    const sio2Effect = sio2Ratio * 0.15;
    const al2o3Effect = al2o3Ratio * 0.10;
    const mgoEffect = mgoRatio * 0.08;
    
    const emissivity = Math.min(Math.max(
      baseEmissivity + caoEffect + sio2Effect + al2o3Effect + mgoEffect,
      0.60
    ), 0.95);
    
    return emissivity;
  }
  
  updateSlagEmissivity() {
    this.state.slagEmissivity = this.calculateSlagEmissivity();
    document.getElementById('slagEmissivity').textContent = this.state.slagEmissivity.toFixed(3);
  }
  
  calculateFlowEfficiency(slagMassFlow) {
    const optimalFlow = 20;
    const flowDeviation = Math.abs(slagMassFlow - optimalFlow) / optimalFlow;
    const efficiencyFactor = Math.exp(-Math.pow(flowDeviation, 2) / 0.5);
    return Math.min(Math.max(efficiencyFactor, 0.4), 1.0);
  }
  
  calculateHeatBalance(dt) {
    const { slagTemp, waterFlow, slagMassFlow, ambientTemp } = this.params;
    const waterFlowKgPerSec = waterFlow / 60;
    const slagTempK = this.state.slagParticleTemp + 273.15;
    const ambientTempK = ambientTemp + 273.15;
    
    const slagEnthalpyIn = slagMassFlow * this.heatCapacity.slag * 
                          (this.state.slagParticleTemp - ambientTemp);
    
    const surfaceArea = 0.5 + slagMassFlow * 0.02;
    const radiativeLoss = this.stefanBoltzmann * this.state.slagEmissivity * 
                          surfaceArea * (Math.pow(slagTempK, 4) - Math.pow(ambientTempK, 4)) / 1000;
    this.state.radiativeLoss = radiativeLoss;
    
    const convectiveCoeff = 10 + slagMassFlow * 0.5;
    const convectiveLoss = convectiveCoeff * surfaceArea * 
                           (this.state.slagParticleTemp - ambientTemp) / 1000;
    this.state.convectiveLoss = convectiveLoss;
    
    const totalLoss = radiativeLoss + convectiveLoss;
    
    const slagWaterRatio = slagMassFlow / Math.max(waterFlowKgPerSec, 0.1);
    this.state.slagWaterRatio = slagWaterRatio;
    
    const optimalRatio = 5;
    const ratioFactor = Math.exp(-Math.pow((slagWaterRatio - optimalRatio), 2) / 15);
    
    const baseHeatTransferCoeff = 150;
    this.state.heatTransferCoeff = baseHeatTransferCoeff * ratioFactor * 
                                    (1 + slagMassFlow / 50) * 0.9;
    
    const availableHeat = slagMassFlow * this.heatCapacity.slag * 
                          (this.state.slagParticleTemp - this.waterBoilingTemp);
    const heatTransferFactor = this.state.heatTransferCoeff / baseHeatTransferCoeff;
    const maxTransferrableHeat = Math.min(availableHeat / 8 * heatTransferFactor, 
                                         waterFlowKgPerSec * this.heatCapacity.water * 
                                         (this.waterBoilingTemp - ambientTemp) * 3);
    
    const flowEfficiency = this.calculateFlowEfficiency(slagMassFlow);
    this.state.flowEfficiencyFactor = flowEfficiency;
    
    const grossHeatTransfer = maxTransferrableHeat * flowEfficiency;
    const netHeatTransfer = Math.max(grossHeatTransfer - totalLoss * dt, 0);
    
    this.state.slagParticleTemp -= ((grossHeatTransfer + totalLoss * dt) / 
                                   (slagMassFlow * this.heatCapacity.slag)) * dt;
    
    const heatForWater = netHeatTransfer * 0.75;
    const waterHeated = Math.min(
      heatForWater / (this.heatCapacity.water * (this.waterBoilingTemp - ambientTemp)),
      waterFlowKgPerSec * dt
    );
    
    const heatToBoil = waterHeated * this.heatCapacity.water * 
                       (this.waterBoilingTemp - ambientTemp);
    const heatAfterBoil = heatForWater - heatToBoil;
    
    let waterEvaporated = 0;
    let heatForSuperheat = 0;
    
    if (heatAfterBoil > 0) {
      const latentHeatNeeded = waterHeated * this.latentHeat.vaporization;
      
      if (heatAfterBoil >= latentHeatNeeded) {
        waterEvaporated = waterHeated;
        heatForSuperheat = heatAfterBoil - latentHeatNeeded;
      } else {
        waterEvaporated = heatAfterBoil / this.latentHeat.vaporization;
        heatForSuperheat = 0;
      }
      
      if (waterEvaporated > 0) {
        const maxSuperheatTemp = Math.min(this.state.slagParticleTemp * 0.35, 450);
        
        if (heatForSuperheat > 0) {
          const possibleTempRise = heatForSuperheat / 
                                   (waterEvaporated * this.heatCapacity.steam);
          const actualTempRise = Math.min(possibleTempRise, maxSuperheatTemp - 100);
          const radiativeReduction = 0.08;
          this.state.steamTemperature = 100 + actualTempRise * (1 - radiativeReduction);
          this.state.superheatedSteam = waterEvaporated / dt;
        } else {
          this.state.steamTemperature = 100;
          this.state.superheatedSteam = waterEvaporated / dt;
        }
      } else {
        this.state.steamTemperature = 100;
        this.state.superheatedSteam = 0;
      }
    } else {
      this.state.steamTemperature = 100;
      this.state.superheatedSteam = 0;
    }
    
    this.state.waterEvaporated = waterEvaporated / dt;
    this.state.steamProduction = waterEvaporated / dt;
    this.state.energyRecovered = (netHeatTransfer / 1000) * dt;
    this.state.totalEnergy += this.state.energyRecovered;
    
    const maxRecoveryPotential = slagMassFlow * this.heatCapacity.slag * 
                                (slagTemp - ambientTemp);
    this.state.heatRecoveryRate = (this.state.totalEnergy * 1000 / 
                                   Math.max(maxRecoveryPotential, 1)) * 100;
    
    const t0 = ambientTemp + 273.15;
    const slagExergy = slagMassFlow * this.heatCapacity.slag * 
                      ((slagTempK - t0) - t0 * Math.log(Math.max(slagTempK / t0, 1.0001)));
    const recoveredExergy = this.state.steamProduction * 
                           (this.latentHeat.vaporization + 
                            this.heatCapacity.steam * Math.max(this.state.steamTemperature - 100, 0));
    this.state.exergyEfficiency = Math.min(
      (recoveredExergy / Math.max(slagExergy, 1)) * 100, 95
    );
    
    this.state.effectiveEfficiency = this.state.heatRecoveryRate * flowEfficiency;
    
    this.state.heatBalance = {
      input: slagEnthalpyIn,
      recovered: netHeatTransfer,
      radiative: radiativeLoss * dt * 1000,
      convective: convectiveLoss * dt * 1000,
      slagSensible: slagMassFlow * this.heatCapacity.slag * 
                   (this.state.slagParticleTemp - ambientTemp),
      unaccounted: slagEnthalpyIn - netHeatTransfer * 1000 - 
                  (radiativeLoss + convectiveLoss) * dt * 1000 -
                  slagMassFlow * this.heatCapacity.slag * 
                  (this.state.slagParticleTemp - ambientTemp)
    };
    
    this.state.slagParticleTemp = Math.max(
      this.state.slagParticleTemp - (this.state.slagParticleTemp - ambientTemp) * 0.0005 * dt,
      ambientTemp + 50
    );
    
    this.state.time += dt;
  }
  
  createSlagParticle() {
    const x = 150;
    const y = 150;
    const targetX = 350 + Math.random() * 300;
    const targetY = 300 + Math.random() * 100;
    
    this.slagParticles.push({
      x, y,
      targetX, targetY,
      vx: (targetX - x) / 60,
      vy: (targetY - y) / 60,
      temp: this.params.slagTemp,
      size: 3 + Math.random() * 4,
      life: 1,
      alpha: 1
    });
  }
  
  createSteamParticle(x, y) {
    this.steamParticles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1 - Math.random() * 2,
      size: 5 + Math.random() * 10,
      life: 1,
      alpha: 0.6 + Math.random() * 0.4
    });
  }
  
  createWaterDroplet() {
    const granulatorX = 500;
    const granulatorY = 200;
    
    this.waterDroplets.push({
      x: granulatorX + (Math.random() - 0.5) * 40,
      y: granulatorY + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 2,
      size: 2 + Math.random() * 3,
      temp: this.params.ambientTemp,
      life: 1
    });
  }
  
  updateParticles(dt) {
    if (this.isRunning) {
      if (Math.random() < 0.3) {
        this.createSlagParticle();
      }
      if (Math.random() < 0.5) {
        this.createWaterDroplet();
      }
    }
    
    this.slagParticles = this.slagParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.temp = Math.max(p.temp - 5 * dt, this.waterBoilingTemp);
      p.life -= 0.005;
      p.alpha = p.life;
      return p.life > 0;
    });
    
    this.waterDroplets = this.waterDroplets.filter(d => {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.1;
      
      if (d.y > 400 && this.isRunning && this.state.steamProduction > 0.01) {
        if (Math.random() < 0.3) {
          this.createSteamParticle(d.x, d.y);
        }
        return false;
      }
      
      d.life -= 0.01;
      return d.life > 0 && d.y < 500;
    });
    
    this.steamParticles = this.steamParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.size += 0.05;
      p.life -= 0.008;
      p.alpha = p.life * 0.7;
      return p.life > 0;
    });
  }
  
  drawBackground() {
    const layer = this.canvasLayers.backgroundLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    const { canvas } = layer;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    ctx.fillStyle = '#2d2d4a';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    
    const groundGradient = ctx.createLinearGradient(0, canvas.height - 50, 0, canvas.height);
    groundGradient.addColorStop(0, '#2d2d4a');
    groundGradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
  }
  
  drawEquipment() {
    this.drawSlagPot();
    this.drawGranulator();
  }
  
  drawSlagPot() {
    const layer = this.canvasLayers.equipmentLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    const { canvas } = layer;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const x = 100;
    const y = 100;
    const width = 120;
    const height = 150;
    
    ctx.save();
    
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#8b0000');
    gradient.addColorStop(0.5, '#a52a2a');
    gradient.addColorStop(1, '#660000');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.3, y + 20);
    ctx.lineTo(x + width * 0.7, y + 20);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width + 10, y + height);
    ctx.lineTo(x - 10, y + height);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.fillStyle = '#666';
    ctx.fillRect(x + width + 5, y + height - 5, 40, 10);
    ctx.fillRect(x - 35, y + height - 5, 30, 10);
    
    ctx.fillStyle = '#ff6b35';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('渣罐', x + width / 2, y + height + 30);
    ctx.fillText(`${this.params.slagTemp}°C`, x + width / 2, y + height + 45);
    
    ctx.restore();
  }
  
  drawGranulator() {
    const layer = this.canvasLayers.equipmentLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    const x = 480;
    const y = 150;
    const width = 80;
    const height = 100;
    
    ctx.save();
    
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#3498db');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x + width / 2, y);
    ctx.lineTo(x + width, y + 20);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height + 10, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('粒化器', x + width / 2, y - 10);
    ctx.fillText(`${this.params.waterFlow}L/min`, x + width / 2, y - 25);
    
    ctx.restore();
  }
  
  drawFlowingSlag() {
    const layer = this.canvasLayers.flowLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    if (!this.isRunning) return;
    
    const startX = 180;
    const startY = 240;
    const endX = 350;
    const endY = 280;
    
    ctx.save();
    
    const flowOffset = (Date.now() / 50) % 20;
    
    for (let i = 0; i < 5; i++) {
      const t = (i * 0.25 + flowOffset / 100) % 1;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      const size = 4 + Math.sin(t * Math.PI) * 2;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
      gradient.addColorStop(0, 'rgba(255, 150, 50, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  drawSlagGlow() {
    const layer = this.canvasLayers.equipmentLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    if (!this.isRunning) return;
    
    const x = 100;
    const y = 100;
    const width = 120;
    const height = 150;
    
    const slagGlow = ctx.createRadialGradient(
      x + width / 2, y + height - 20, 0,
      x + width / 2, y + height - 20, 80
    );
    slagGlow.addColorStop(0, `rgba(255, 100, 0, ${0.5 + Math.sin(Date.now() / 200) * 0.2})`);
    slagGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = slagGlow;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height - 20, 80, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawNozzles() {
    const layer = this.canvasLayers.equipmentLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    if (!this.isRunning) return;
    
    const x = 480;
    const y = 150;
    const width = 80;
    const height = 100;
    
    ctx.fillStyle = '#64ffda';
    const numNozzles = 5;
    for (let i = 0; i < numNozzles; i++) {
      const nx = x + 15 + i * 15;
      const ny = y + height + 15 + Math.sin(Date.now() / 100 + i) * 3;
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawSlagParticles() {
    const layer = this.canvasLayers.slagLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    this.slagParticles.forEach(p => {
      const tempRatio = Math.max(0, (p.temp - 100) / (this.params.slagTemp - 100));
      const r = Math.floor(255 * tempRatio);
      const g = Math.floor(100 * tempRatio);
      const b = Math.floor(0);
      
      ctx.save();
      ctx.globalAlpha = p.alpha;
      
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      gradient.addColorStop(0, `rgba(${r}, ${g + 50}, ${b}, 1)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.8)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = `rgba(${r + 30}, ${g + 80}, ${b + 20}, 1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }
  
  drawSteamParticles() {
    const layer = this.canvasLayers.steamLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    this.steamParticles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.6;
      
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.4)');
      gradient.addColorStop(1, 'rgba(200, 200, 200, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }
  
  drawWaterDroplets() {
    const layer = this.canvasLayers.waterLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    this.waterDroplets.forEach(d => {
      ctx.save();
      
      const gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size);
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
      gradient.addColorStop(1, 'rgba(50, 150, 255, 0.3)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }
  
  drawTemperatureScale() {
    const layer = this.canvasLayers.uiLayer;
    if (!layer) return;
    const ctx = layer.ctx;
    const { canvas } = layer;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const x = canvas.width - 60;
    const y = 50;
    const width = 30;
    const height = 200;
    
    ctx.save();
    
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.3, '#ff6b35');
    gradient.addColorStop(0.6, '#ffff00');
    gradient.addColorStop(1, '#0066ff');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('1600°C', x - 5, y + 10);
    ctx.fillText('1000°C', x - 5, y + height * 0.4);
    ctx.fillText('100°C', x - 5, y + height * 0.75);
    ctx.fillText('25°C', x - 5, y + height - 5);
    
    if (this.isRunning || this.state.slagParticleTemp < this.params.slagTemp) {
      const tempRatio = Math.max(0, (this.state.slagParticleTemp - 25) / 1575);
      const indicatorY = y + height * (1 - tempRatio);
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + width + 5, indicatorY);
      ctx.lineTo(x + width + 15, indicatorY - 5);
      ctx.lineTo(x + width + 15, indicatorY + 5);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#ff6b35';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(this.state.slagParticleTemp)}°C`, x + width + 20, indicatorY + 4);
    }
    
    ctx.restore();
  }
  
  updateDisplay() {
    document.getElementById('slagParticleTemp').textContent = 
      `${Math.round(this.state.slagParticleTemp)} °C`;
    document.getElementById('steamProduction').textContent = 
      `${this.state.steamProduction.toFixed(3)} kg/s`;
    document.getElementById('heatRecoveryRate').textContent = 
      `${this.state.heatRecoveryRate.toFixed(1)} %`;
    document.getElementById('waterEvaporated').textContent = 
      `${this.state.waterEvaporated.toFixed(3)} kg/s`;
    document.getElementById('energyRecovered').textContent = 
      `${(this.state.energyRecovered / 1000).toFixed(3)} MW`;
    document.getElementById('totalEnergy').textContent = 
      `${(this.state.totalEnergy).toFixed(2)} MJ`;
    document.getElementById('steamTemperature').textContent = 
      `${Math.round(this.state.steamTemperature)} °C`;
    document.getElementById('superheatedSteam').textContent = 
      `${this.state.superheatedSteam.toFixed(3)} kg/s`;
    document.getElementById('slagWaterRatio').textContent = 
      `${this.state.slagWaterRatio.toFixed(2)}`;
    document.getElementById('exergyEfficiency').textContent = 
      `${this.state.exergyEfficiency.toFixed(1)} %`;
    document.getElementById('radiativeLoss').textContent = 
      `${this.state.radiativeLoss.toFixed(2)} kW`;
    document.getElementById('slagEmissivity').textContent = 
      `${this.state.slagEmissivity.toFixed(3)}`;
    document.getElementById('effectiveEfficiency').textContent = 
      `${this.state.effectiveEfficiency.toFixed(1)} %`;
  }
  
  async saveParams() {
    try {
      await fetch('/api/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slagTemperature: this.params.slagTemp,
          waterFlow: this.params.waterFlow,
          slagMassFlow: this.params.slagMassFlow,
          slagInitialTemp: this.params.slagTemp
        })
      });
    } catch (e) {
      console.log('保存参数失败:', e);
    }
  }
  
  async saveSnapshot() {
    try {
      await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slagTemp: this.state.slagParticleTemp,
          steamProduction: this.state.steamProduction,
          heatRecoveryRate: this.state.heatRecoveryRate,
          waterEvaporated: this.state.waterEvaporated,
          energyRecovered: this.state.energyRecovered,
          steamTemperature: this.state.steamTemperature,
          superheatedSteam: this.state.superheatedSteam,
          radiativeLoss: this.state.radiativeLoss,
          convectiveLoss: this.state.convectiveLoss,
          slagWaterRatio: this.state.slagWaterRatio,
          exergyEfficiency: this.state.exergyEfficiency,
          totalEnergy: this.state.totalEnergy,
          slagMassFlow: this.params.slagMassFlow,
          waterFlow: this.params.waterFlow,
          slagInitialTemp: this.params.slagTemp,
          effectiveEfficiency: this.state.effectiveEfficiency,
          slagEmissivity: this.state.slagEmissivity,
          flowEfficiencyFactor: this.state.flowEfficiencyFactor,
          slagComposition: JSON.stringify(this.params.slagComposition)
        })
      });
      alert('快照已保存！包含完整热量核算数据');
    } catch (e) {
      console.log('保存快照失败:', e);
    }
  }
  
  async loadParams() {
    try {
      const res = await fetch('/api/params');
      const data = await res.json();
      
      let html = '<table><tr><th>时间</th><th>渣温(°C)</th><th>水量(L/min)</th><th>渣量(kg/s)</th></tr>';
      data.forEach(row => {
        html += `<tr>
          <td>${new Date(row.timestamp).toLocaleString()}</td>
          <td>${row.slag_temperature}</td>
          <td>${row.water_flow}</td>
          <td>${row.slag_mass_flow}</td>
        </tr>`;
      });
      html += '</table>';
      document.getElementById('dataDisplay').innerHTML = html;
    } catch (e) {
      console.log('加载参数失败:', e);
    }
  }
  
  async loadSnapshots() {
    try {
      const res = await fetch('/api/snapshots');
      const data = await res.json();
      
      let html = '<table><tr><th>时间</th><th>渣温(°C)</th><th>汽温(°C)</th><th>蒸汽(kg/s)</th><th>回收率(%)</th><th>火用效率(%)</th><th>渣水比</th><th>热平衡(MJ)</th></tr>';
      data.forEach(row => {
        html += `<tr>
          <td>${new Date(row.timestamp).toLocaleString()}</td>
          <td>${row.slag_temp.toFixed(1)}</td>
          <td>${(row.steam_temperature || 100).toFixed(0)}</td>
          <td>${row.steam_production.toFixed(3)}</td>
          <td>${row.heat_recovery_rate.toFixed(1)}</td>
          <td>${(row.exergy_efficiency || 0).toFixed(1)}</td>
          <td>${(row.slag_water_ratio || 0).toFixed(2)}</td>
          <td>${(row.heat_balance || 0).toFixed(2)}</td>
        </tr>`;
      });
      html += '</table>';
      document.getElementById('dataDisplay').innerHTML = html;
    } catch (e) {
      console.log('加载快照失败:', e);
    }
  }
  
  animate() {
    const dt = 0.016;
    
    if (this.isRunning) {
      this.calculateHeatBalance(dt);
    }
    
    this.updateParticles(dt);
    
    this.drawFlowingSlag();
    this.drawSlagGlow();
    this.drawNozzles();
    this.drawWaterDroplets();
    this.drawSlagParticles();
    this.drawSteamParticles();
    this.drawTemperatureScale();
    
    this.updateDisplay();
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SlagSimulation();
});
