export function initCricketGame() {
  const section = document.getElementById('cricket-game');
  const canvas = document.getElementById('cricket-canvas');
  if (!canvas || !section) return;
  const ctx = canvas.getContext('2d');

  const startOverlay = document.getElementById('game-start-overlay');
  const startBtn = document.getElementById('game-start-btn');
  
  const hitOutcome = document.getElementById('game-hit-outcome');
  const hitText = document.getElementById('game-hit-text');
  
  const actionWrap = document.getElementById('game-action-wrap');
  const hitBtn = document.getElementById('game-hit-btn');
  const nextBtn = document.getElementById('game-next-btn');
  
  const flashEl = document.getElementById('game-flash');

  let W, H;
  let rafId = null;
  
  // Game State
  let state = 'IDLE'; // IDLE, PITCHING, HIT_ANIM, WAIT, REWARD
  let score = 0;
  let currentBall = 0;
  
  // Physics & Entities
  let ball = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, active: false, radius: 5, type: 'good', trail: [], hitResult: null };
  let batsman = { swingTime: 0, isSwinging: false, stanceOffset: 0 };
  let bowler = { actionTime: 0, isBowling: false };
  let cameraShake = { x: 0, y: 0, time: 0 };
  let sparks = [];

  function resize() {
    W = canvas.width = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Audio Context
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  
  function playSound(type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    
    if (type === 'hit') {
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.1);
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.connect(gain);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'bowled') {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      osc.start(t); osc.stop(t + 0.3);
    }
  }

  // Draw functions
  function drawPitch() {
    const isLight = document.documentElement.classList.contains('light');
    const horizon = H * 0.3; // Horizon is higher up in 3rd person
    
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, isLight ? '#87ceeb' : '#020d05');
    sky.addColorStop(1, isLight ? '#dff0f8' : '#061709');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // Turf
    const turf = ctx.createLinearGradient(0, horizon, 0, H);
    turf.addColorStop(0, isLight ? '#2e7d2e' : '#071507');
    turf.addColorStop(1, isLight ? '#4cae4c' : '#0d2a0d');
    ctx.fillStyle = turf;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Pitch (trapezoid)
    // Top is narrow (horizon), bottom is wide (camera)
    const pitchTopW = W * 0.15;
    const pitchBotW = W * 0.6;
    ctx.fillStyle = isLight ? 'rgba(210,180,100,0.6)' : 'rgba(200,180,120,0.08)';
    ctx.beginPath();
    ctx.moveTo(W/2 - pitchTopW/2, horizon);
    ctx.lineTo(W/2 + pitchTopW/2, horizon);
    ctx.lineTo(W/2 + pitchBotW/2, H);
    ctx.lineTo(W/2 - pitchBotW/2, H);
    ctx.fill();

    // Crease lines (Far end)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W/2 - pitchTopW*0.6, horizon + 20);
    ctx.lineTo(W/2 + pitchTopW*0.6, horizon + 20);
    ctx.stroke();

    // Crease lines (Near end)
    const creaseY = H * 0.8;
    const creaseW = pitchTopW + ((pitchBotW - pitchTopW) * ((creaseY - horizon) / (H - horizon)));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W/2 - creaseW*0.6, creaseY);
    ctx.lineTo(W/2 + creaseW*0.6, creaseY);
    ctx.stroke();

    // Stumps (Far end - Bowler)
    const fsx = W/2, fsy = horizon + 5;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(fsx - 3, fsy - 12, 1.5, 12);
    ctx.fillRect(fsx, fsy - 12, 1.5, 12);
    ctx.fillRect(fsx + 3, fsy - 12, 1.5, 12);

    // Stumps (Near end - Striker)
    // Placed slightly behind the batsman
    const nsx = W/2, nsy = H * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(nsx - 12, nsy - 40, 4, 40);
    ctx.fillRect(nsx, nsy - 40, 4, 40);
    ctx.fillRect(nsx + 12, nsy - 40, 4, 40);
    ctx.fillRect(nsx - 14, nsy - 40, 32, 2); // Bails
    
    // Scoring zones overlay in distance
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#39ff14';
    ctx.beginPath(); ctx.ellipse(W*0.2, horizon-10, 100, 40, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.ellipse(W*0.8, horizon-10, 100, 40, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBowler() {
    // Distant bowler silhouette
    const bx = W/2 + 20; // Starts slightly off center
    const by = H * 0.3; // At horizon
    
    // Simple sleek geometry to maintain premium feel, not cartoonish
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    
    let armRaise = 0;
    if (bowler.isBowling) {
      armRaise = Math.sin(bowler.actionTime * Math.PI); // Arm goes up and over
    }

    // Body
    ctx.beginPath();
    ctx.arc(bx, by - 25, 4, 0, Math.PI*2); // Head
    ctx.fill();
    ctx.fillRect(bx - 3, by - 20, 6, 15); // Torso
    ctx.fillRect(bx - 3, by - 5, 2, 10); // Leg L
    ctx.fillRect(bx + 1, by - 5, 2, 10); // Leg R

    // Bowling Arm
    ctx.save();
    ctx.translate(bx - 4, by - 18);
    ctx.rotate(-armRaise * Math.PI); // Rotate from back to front
    ctx.fillRect(-1.5, 0, 3, 12);
    ctx.restore();
  }

  function drawBatsman() {
    // 3rd person batsman at the crease
    // Sleek, minimal geometry. Premium silhouette.
    const isLight = document.documentElement.classList.contains('light');
    const bx = W/2 - 15; // Standing slightly leg side
    const by = H * 0.85; 
    const scale = 1.2;
    
    const colorBody = isLight ? '#222' : '#eee';
    const colorBat = '#e8c878';
    
    // Idle bobbing
    batsman.stanceOffset = Math.sin(Date.now() / 200) * 2;
    const bodyY = by + (batsman.isSwinging ? 0 : batsman.stanceOffset);
    
    ctx.save();
    ctx.translate(bx, bodyY);
    ctx.scale(scale, scale);
    
    // Draw Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Body (Sleek athletic silhouette)
    ctx.fillStyle = colorBody;
    ctx.beginPath();
    ctx.arc(0, -60, 8, 0, Math.PI*2); // Helmet/Head
    ctx.fill();
    
    // Shoulders & Torso (angled)
    ctx.beginPath();
    ctx.roundRect(-10, -50, 20, 30, 6);
    ctx.fill();
    
    // Legs
    ctx.fillRect(-7, -20, 6, 20); // Front leg
    ctx.fillRect(3, -20, 6, 20);  // Back leg
    
    // Arms & Bat (Swing logic)
    ctx.save();
    ctx.translate(0, -40); // Shoulder joint
    
    // Swing interpolation
    // Idle: Bat points down and back. Swing goes from back -> front -> follow through
    let swingAngle = -Math.PI * 0.15; // Idle
    let batTilt = Math.PI * 0.2;
    
    if (batsman.isSwinging) {
      // Swing time 0 to 1
      const st = batsman.swingTime;
      // Arc from -20deg back to +180deg follow through
      swingAngle = -Math.PI * 0.15 + (st * Math.PI * 1.5);
      batTilt = Math.PI * 0.2 - (st * Math.PI * 0.1);
    }
    
    ctx.rotate(swingAngle);
    
    // Arms
    ctx.strokeStyle = colorBody;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 25); // Extend arms holding bat
    ctx.stroke();
    
    // Bat
    ctx.translate(0, 25);
    ctx.rotate(batTilt);
    ctx.fillStyle = colorBat;
    
    // Glow effect if idle
    if (!batsman.isSwinging) {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 45, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Neon edge on bat
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // Arms restore
    ctx.restore(); // Body restore
  }

  function drawBall() {
    if (!ball.active) return;
    
    // Perspective math
    // z = 1 (horizon/bowler), z = 0 (crease/batsman), z < 0 (behind batsman)
    const horizon = H * 0.3;
    const creaseY = H * 0.85;
    
    // Linear interpolation for Y position based on Z
    const groundY = horizon + (creaseY - horizon) * (1 - ball.z);
    
    // X position scales out from center to edges
    const centerX = W/2;
    const currentSpread = W * 0.3 * (1 - ball.z); // How wide the pitch is at this Z
    const cx = centerX + (ball.x * currentSpread);
    
    // Scale ball size based on Z
    const scale = 1 + ((1 - ball.z) * 2.5); // Grows 3.5x from distant to near
    const cy = groundY - (ball.y * H * 0.1 * scale); // Bounce height
    
    const r = Math.max(1, ball.radius * scale);

    if (ball.z < -0.2 || ball.z > 1.5) return; // Out of bounds
    
    // Draw Shadow
    ctx.globalAlpha = 0.3 * Math.max(0, 1 - Math.abs(ball.y));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, groundY, r*1.2, r*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw Motion trail
    ball.trail.push({cx, cy, r});
    if (ball.trail.length > 8) ball.trail.shift();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ff4444';
    for (let i=0; i<ball.trail.length-1; i++) {
       const t = ball.trail[i];
       ctx.beginPath();
       ctx.arc(t.cx, t.cy, t.r * (i/8), 0, Math.PI*2);
       ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw Ball Body
    const bg = ctx.createRadialGradient(cx-r*0.3, cy-r*0.3, r*0.1, cx, cy, r);
    bg.addColorStop(0, '#ff7755');
    bg.addColorStop(0.5, '#cc2200');
    bg.addColorStop(1, '#550000');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fill();
  }
  
  function drawSparks() {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.cx += p.vx; p.cy += p.vy;
      p.alpha -= 0.04;
      if (p.alpha <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.cx, p.cy, p.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    ctx.save();
    // Camera shake
    if (cameraShake.time > 0) {
      const mag = cameraShake.time * 12;
      const dx = (Math.random()-0.5)*mag;
      const dy = (Math.random()-0.5)*mag;
      ctx.translate(dx, dy);
      cameraShake.time -= 0.05;
    }
    
    ctx.clearRect(0, 0, W, H);
    drawPitch();
    drawBowler();
    
    if (ball.active) {
      // Physics step
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.z += ball.vz;
      ball.vy -= 0.0035; // gravity
      
      // Bounce
      if (ball.y < 0 && ball.vz < 0 && !ball.hitResult) { 
        ball.y = 0;
        ball.vy = Math.abs(ball.vy) * 0.7; // restitution (bounce)
      }
      
      // Post-hit trajectory flying back into distance
      if (ball.hitResult && ball.z > 1.2) {
        ball.active = false;
        resolveBallOutcome();
      }
      
      // Missed / Bowled
      if (!ball.hitResult && ball.z < -0.05) {
        ball.active = false;
        // Check if bowled (on target horizontally and low enough)
        if (Math.abs(ball.x) < 0.3 && ball.y < 0.5) {
           triggerBowled();
        } else {
           triggerMiss();
        }
      }
    }
    
    // Draw elements
    // Depth sorting: Ball in distance -> Bowler -> Ball -> Batsman
    drawBall();
    drawSparks();
    
    // Bowler animation
    if (bowler.isBowling) {
      bowler.actionTime += 0.06;
      if (bowler.actionTime >= 1) bowler.isBowling = false;
    }
    
    // Batsman animation
    if (batsman.isSwinging) {
      batsman.swingTime += 0.12; // Fast snappy swing
      if (batsman.swingTime >= 1) batsman.isSwinging = false;
    }
    drawBatsman();
    
    ctx.restore();
    rafId = requestAnimationFrame(tick);
  }

  function launchBall() {
    actionWrap.classList.add('visible');
    hitBtn.style.display = 'block';
    nextBtn.style.display = 'none';
    hitOutcome.classList.remove('visible');
    
    const types = ['yorker', 'full', 'good', 'bouncer'];
    const type = types[Math.floor(Math.random()*types.length)];
    
    bowler.isBowling = true;
    bowler.actionTime = 0;
    
    // Delay ball release to match bowler animation
    setTimeout(() => {
      ball.active = true;
      ball.z = 1.0;
      ball.x = (Math.random() - 0.5) * 0.1; // Line (tight)
      ball.y = 0.4; // Release height
      ball.vz = -0.015 - (Math.random() * 0.005); // Speed
      ball.vx = (0 - ball.x) * 0.015; // Aim towards stumps
      ball.trail = [];
      ball.hitResult = null;
      
      if (type === 'yorker') {
        ball.vy = -0.002; 
      } else if (type === 'full') {
        ball.vy = 0.005; // pitch at z=0.2
      } else if (type === 'good') {
        ball.vy = 0.022; // pitch at z=0.5
      } else if (type === 'bouncer') {
        ball.vy = 0.038; // pitch early
      }
      state = 'PITCHING';
    }, 250);
  }

  function attemptHit() {
    if (state !== 'PITCHING' || batsman.isSwinging) return;
    initAudio();
    batsman.isSwinging = true;
    batsman.swingTime = 0;
    actionWrap.classList.remove('visible'); 
    
    // Timing logic based on ball's Z
    // Sweet spot: z between 0.02 and 0.18
    const z = ball.z;
    
    if (z > 0.02 && z < 0.18 && ball.y < 0.6) {
      // Perfect timing
      const r = Math.random();
      if (r > 0.4) triggerHit('SIX', 6);
      else triggerHit('FOUR', 4);
    } else if (z >= 0.18 && z < 0.35) {
      // Early
      const r = Math.random();
      if (r > 0.6) triggerHit('THREE', 3);
      else if (r > 0.3) triggerHit('TWO', 2);
      else triggerHit('ONE', 1);
    } else {
      // Late or too early -> Miss
    }
  }

  function triggerHit(label, runs) {
    ball.hitResult = { label, runs };
    playSound('hit');
    
    // Hit Stop (freeze ball briefly)
    ball.vz = 0; ball.vx = 0; ball.vy = 0;
    
    // Visual effects
    cameraShake.time = 0.8;
    flashEl.classList.add('active');
    setTimeout(() => flashEl.classList.remove('active'), 50);
    
    // Sparks at ball location
    const cx = W/2 + (ball.x * W * 0.3);
    const cy = H * 0.85 - (ball.y * H * 0.1);
    
    for(let i=0; i<15; i++){
       sparks.push({
         cx: cx, cy: cy,
         vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12 - 4,
         alpha: 1, size: 2+Math.random()*4, color: Math.random()>0.5?'#39ff14':'#fff'
       });
    }
    
    setTimeout(() => {
       if(!ball.active) return;
       // Reverse vector and fly away
       ball.vz = 0.035; // Fast away into distance
       ball.vy = runs >= 4 ? 0.045 : 0.015; // High if 4/6
       ball.vx = (Math.random() - 0.5) * 0.04;
    }, 80); // Hit stop duration
  }

  function resolveBallOutcome() {
    const res = ball.hitResult;
    score += res.runs;
    showOutcomeText(`${res.label}!`, res.runs >= 4 ? '#39ff14' : '#ffcc00');
    finishBall();
  }

  function triggerBowled() {
    playSound('bowled');
    cameraShake.time = 1.0;
    showOutcomeText('CLEAN BOWLED! 💥', '#ff4444');
    finishBall(true); // true = out
  }
  
  function triggerMiss() {
    showOutcomeText('MISSED!', '#aaaaaa');
    finishBall();
  }

  function showOutcomeText(text, color) {
    hitText.textContent = text;
    hitText.style.color = color;
    hitText.style.textShadow = `0 0 20px ${color}, 0 0 50px ${color}`;
    hitOutcome.classList.add('visible');
  }

  function finishBall(isOut = false) {
    currentBall++;
    state = 'WAIT';
    actionWrap.classList.remove('visible');
    
    setTimeout(() => {
      hitOutcome.classList.remove('visible');
      hitBtn.style.display = 'none';
      nextBtn.style.display = 'block';
      actionWrap.classList.add('visible');
    }, 1200);
  }

  // Event Listeners
  startBtn.addEventListener('click', () => {
    initAudio();
    startOverlay.classList.add('hidden');
    currentBall = 0; score = 0;
    launchBall();
  });
  
  hitBtn.addEventListener('touchstart', (e) => { e.preventDefault(); attemptHit(); }, {passive: false});
  hitBtn.addEventListener('mousedown', attemptHit);
  
  nextBtn.addEventListener('click', launchBall);
  nextBtn.addEventListener('touchstart', (e) => { e.preventDefault(); launchBall(); }, {passive: false});
  
  // Allow tapping anywhere on the game area as a fallback
  section.addEventListener('mousedown', (e) => { 
    if (e.target !== startBtn && e.target !== nextBtn) attemptHit(); 
  });
  section.addEventListener('touchstart', (e) => { 
    if (e.target !== startBtn && e.target !== nextBtn) attemptHit(); 
  }, {passive: true});

  // Observe to pause game when off-screen
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (entry.isIntersecting && !rafId) {
      tick();
    }
  }, { threshold: 0.1 });
  io.observe(section);

  // Initial draw
  ctx.clearRect(0, 0, W, H);
  drawPitch();
  drawBowler();
  drawBatsman();
}
