    (() => {
      'use strict';

      const SIZE = 1000;
      const coffeeCanvas = document.getElementById('coffeeCanvas');
      const guideCanvas = document.getElementById('guideCanvas');
      const milkCanvas = document.getElementById('milkCanvas');
      const coffeeSurface = document.getElementById('coffeeSurface');
      const coffeeCtx = coffeeCanvas.getContext('2d');
      const guideCtx = guideCanvas.getContext('2d');
      const milkCtx = milkCanvas.getContext('2d');
      const sizeRange = document.getElementById('sizeRange');
      const sizeValue = document.getElementById('sizeValue');
      const sizeLabel = document.getElementById('sizeLabel');
      const undoButton = document.getElementById('undoButton');
      const clearButton = document.getElementById('clearButton');
      const saveButton = document.getElementById('saveButton');
      const soundButton = document.getElementById('soundButton');
      const drawHint = document.getElementById('drawHint');
      const snapFeedback = document.getElementById('snapFeedback');
      const strokeCount = document.getElementById('strokeCount');
      const patternStatus = document.getElementById('patternStatus');
      const autoSnapToggle = document.getElementById('autoSnapToggle');
      const snapHint = document.getElementById('snapHint');
      const snapState = document.getElementById('snapState');
      const toast = document.getElementById('toast');
      const resultModal = document.getElementById('resultModal');
      const resultImage = document.getElementById('resultImage');
      const resultDate = document.getElementById('resultDate');
      const scoreStars = document.getElementById('scoreStars');
      const scoreTitle = document.getElementById('scoreTitle');
      const scoreValue = document.getElementById('scoreValue');
      const scoreCopy = document.getElementById('scoreCopy');
      const scoreCoverageValue = document.getElementById('scoreCoverageValue');
      const scoreCoverageBar = document.getElementById('scoreCoverageBar');
      const scoreBalanceValue = document.getElementById('scoreBalanceValue');
      const scoreBalanceBar = document.getElementById('scoreBalanceBar');
      const scorePatternValue = document.getElementById('scorePatternValue');
      const scorePatternBar = document.getElementById('scorePatternBar');
      const downloadButton = document.getElementById('downloadButton');
      const downloadLabel = document.getElementById('downloadLabel');
      const modalClose = document.getElementById('modalClose');
      const continueButton = document.getElementById('continueButton');

      const colors = {
        vanilla: { fill: '#f5e5c0', edge: '#e5d0a7', highlight: 'rgba(255, 254, 243, .72)' },
        rose: { fill: '#eab4aa', edge: '#d79b91', highlight: 'rgba(255, 244, 237, .66)' },
        matcha: { fill: '#c7d3a1', edge: '#aebd88', highlight: 'rgba(242, 250, 217, .64)' },
        caramel: { fill: '#dca76f', edge: '#c38c56', highlight: 'rgba(255, 233, 194, .58)' }
      };

      const patternNames = {
        free: '自由发挥',
        heart: '爱心模板',
        leaf: '叶片模板',
        tulip: '郁金香模板'
      };

      const state = {
        tool: 'milk',
        color: 'vanilla',
        size: 46,
        pattern: 'free',
        autoSnap: true,
        strokes: [],
        drawing: false,
        currentStroke: null,
        lastPoint: null,
        lastScore: 0,
        saving: false,
        sound: true,
        modalOpener: null,
        toastTimer: null
      };

      let audioContext = null;
      let pourNoise = null;
      let pourGain = null;
      let activePointerId = null;
      const foamPatterns = new Map();
      let foamSurfaceTexture = null;
      const scoreSurface = document.createElement('canvas');
      scoreSurface.width = SIZE;
      scoreSurface.height = SIZE;
      const scoreSurfaceCtx = scoreSurface.getContext('2d', { willReadFrequently: true });

      function mulberry32(seed) {
        return function() {
          let t = seed += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      function getFoamPattern(colorKey) {
        if (foamPatterns.has(colorKey)) return foamPatterns.get(colorKey);
        const texture = document.createElement('canvas');
        texture.width = 180;
        texture.height = 180;
        const ctx = texture.getContext('2d');
        const rand = mulberry32(9200 + Object.keys(colors).indexOf(colorKey) * 731);
        ctx.fillStyle = colors[colorKey].fill;
        ctx.fillRect(0, 0, 180, 180);

        for (let i = 0; i < 34; i++) {
          const x = rand() * 180;
          const y = rand() * 180;
          const radius = 3 + rand() * 15;
          const glow = ctx.createRadialGradient(x - radius * .25, y - radius * .3, 0, x, y, radius);
          glow.addColorStop(0, `rgba(255, 255, 255, ${.08 + rand() * .15})`);
          glow.addColorStop(.7, 'rgba(255, 255, 255, .035)');
          glow.addColorStop(1, 'rgba(104, 60, 36, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 230; i++) {
          const x = rand() * 180;
          const y = rand() * 180;
          const radius = .55 + rand() * 2.7;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = rand() > .48
            ? `rgba(255, 255, 248, ${.08 + rand() * .24})`
            : `rgba(88, 48, 27, ${.045 + rand() * .105})`;
          ctx.fill();
        }

        ctx.globalAlpha = .16;
        ctx.strokeStyle = colors[colorKey].edge;
        ctx.lineWidth = .7;
        for (let i = 0; i < 24; i++) {
          const x = rand() * 180;
          const y = rand() * 180;
          ctx.beginPath();
          ctx.arc(x, y, 2 + rand() * 9, rand() * Math.PI, rand() * Math.PI + 2.2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const pattern = milkCtx.createPattern(texture, 'repeat');
        foamPatterns.set(colorKey, pattern);
        return pattern;
      }

      function getFoamSurfaceTexture() {
        if (foamSurfaceTexture) return foamSurfaceTexture;
        foamSurfaceTexture = document.createElement('canvas');
        foamSurfaceTexture.width = SIZE;
        foamSurfaceTexture.height = SIZE;
        const ctx = foamSurfaceTexture.getContext('2d');
        const rand = mulberry32(77291);

        for (let i = 0; i < 4200; i++) {
          const x = rand() * SIZE;
          const y = rand() * SIZE;
          const radius = .4 + rand() * 3.2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = rand() > .5
            ? `rgba(255, 255, 248, ${.018 + rand() * .085})`
            : `rgba(92, 54, 33, ${.014 + rand() * .055})`;
          ctx.fill();
        }

        for (let i = 0; i < 260; i++) {
          const x = rand() * SIZE;
          const y = rand() * SIZE;
          const radius = 1.5 + rand() * 7;
          ctx.beginPath();
          ctx.arc(x, y, radius, rand() * Math.PI, rand() * Math.PI + .9 + rand() * 1.4);
          ctx.strokeStyle = rand() > .54
            ? `rgba(255, 255, 250, ${.025 + rand() * .08})`
            : `rgba(103, 61, 38, ${.02 + rand() * .055})`;
          ctx.lineWidth = .65 + rand() * .9;
          ctx.stroke();
        }

        return foamSurfaceTexture;
      }

      function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
      }

      function smoothPoints(points) {
        if (points.length < 4) return points.slice();
        const smoothed = [points[0]];
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i];
          const b = points[i + 1];
          smoothed.push({
            x: a.x * .75 + b.x * .25,
            y: a.y * .75 + b.y * .25,
            p: a.p * .75 + b.p * .25
          });
          smoothed.push({
            x: a.x * .25 + b.x * .75,
            y: a.y * .25 + b.y * .75,
            p: a.p * .25 + b.p * .75
          });
        }
        smoothed.push(points[points.length - 1]);
        return smoothed;
      }

      function boundsOfPoints(points) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        points.forEach(point => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
        return {
          minX,
          minY,
          maxX,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2
        };
      }

      function drawCoffee() {
        const ctx = coffeeCtx;
        ctx.clearRect(0, 0, SIZE, SIZE);
        const center = SIZE / 2;
        const rand = mulberry32(1807);

        const base = ctx.createRadialGradient(390, 330, 36, 500, 500, 510);
        base.addColorStop(0, '#b77c4d');
        base.addColorStop(0.36, '#9b603a');
        base.addColorStop(0.74, '#7e482d');
        base.addColorStop(1, '#4e291c');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, SIZE, SIZE);

        ctx.save();
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 38; i++) {
          const radius = 85 + rand() * 410;
          const angle = rand() * Math.PI * 2;
          const x = center + Math.cos(angle) * radius * rand();
          const y = center + Math.sin(angle) * radius * rand();
          const size = 2 + rand() * 10;
          ctx.beginPath();
          ctx.ellipse(x, y, size * (1 + rand()), size, rand() * Math.PI, 0, Math.PI * 2);
          ctx.strokeStyle = i % 3 === 0 ? 'rgba(245, 197, 130, .55)' : 'rgba(55, 25, 14, .55)';
          ctx.lineWidth = 1 + rand() * 2.2;
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.lineCap = 'round';
        for (let i = 0; i < 24; i++) {
          const startAngle = rand() * Math.PI * 2;
          const endAngle = startAngle + .35 + rand() * .9;
          const radius = 70 + rand() * 370;
          ctx.beginPath();
          ctx.arc(center, center, radius, startAngle, endAngle);
          ctx.strokeStyle = rand() > .44 ? '#f9d19b' : '#402316';
          ctx.lineWidth = 1 + rand() * 5;
          ctx.stroke();
        }
        ctx.restore();

        for (let i = 0; i < 150; i++) {
          const angle = rand() * Math.PI * 2;
          const radius = Math.sqrt(rand()) * 440;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const dot = .55 + rand() * 2.6;
          ctx.beginPath();
          ctx.arc(x, y, dot, 0, Math.PI * 2);
          ctx.fillStyle = rand() > .58 ? 'rgba(247, 210, 160, .23)' : 'rgba(49, 22, 14, .2)';
          ctx.fill();
        }

        const edge = ctx.createRadialGradient(500, 500, 390, 500, 500, 510);
        edge.addColorStop(0, 'rgba(33, 15, 9, 0)');
        edge.addColorStop(.82, 'rgba(39, 18, 11, .08)');
        edge.addColorStop(.97, 'rgba(45, 20, 12, .43)');
        edge.addColorStop(1, 'rgba(24, 11, 8, .68)');
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, SIZE, SIZE);

        ctx.save();
        const sheen = ctx.createLinearGradient(250, 140, 680, 650);
        sheen.addColorStop(0, 'rgba(255, 231, 192, .18)');
        sheen.addColorStop(.38, 'rgba(255, 231, 192, .03)');
        sheen.addColorStop(1, 'rgba(42, 20, 12, .08)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.restore();
      }

      function heartPath(ctx) {
        ctx.beginPath();
        ctx.moveTo(500, 725);
        ctx.bezierCurveTo(455, 670, 295, 545, 295, 420);
        ctx.bezierCurveTo(295, 322, 422, 292, 500, 405);
        ctx.bezierCurveTo(578, 292, 705, 322, 705, 420);
        ctx.bezierCurveTo(705, 545, 545, 670, 500, 725);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(500, 680);
        ctx.bezierCurveTo(470, 640, 354, 535, 354, 432);
        ctx.bezierCurveTo(354, 375, 426, 354, 500, 445);
        ctx.bezierCurveTo(574, 354, 646, 375, 646, 432);
        ctx.bezierCurveTo(646, 535, 530, 640, 500, 680);
        ctx.stroke();
      }

      function drawGuide(pattern) {
        guideCtx.clearRect(0, 0, SIZE, SIZE);
        if (pattern === 'free') return;
        guideCtx.save();
        guideCtx.strokeStyle = 'rgba(255, 243, 210, .48)';
        guideCtx.fillStyle = 'rgba(255, 243, 210, .35)';
        guideCtx.lineWidth = 8;
        guideCtx.lineCap = 'round';
        guideCtx.lineJoin = 'round';
        guideCtx.setLineDash([17, 22]);

        if (pattern === 'heart') {
          heartPath(guideCtx);
        } else if (pattern === 'leaf') {
          guideCtx.beginPath();
          guideCtx.moveTo(500, 760);
          guideCtx.quadraticCurveTo(505, 555, 500, 245);
          guideCtx.stroke();
          const leafLevels = [
            [287, 170], [350, 235], [420, 295], [492, 352], [565, 410], [638, 468]
          ];
          leafLevels.forEach(([y, spread], index) => {
            guideCtx.beginPath();
            guideCtx.moveTo(500, y);
            guideCtx.quadraticCurveTo(500 - spread * .4, y + 22, 500 - spread, y + (index % 2 ? 68 : 53));
            guideCtx.stroke();
            guideCtx.beginPath();
            guideCtx.moveTo(500, y + 16);
            guideCtx.quadraticCurveTo(500 + spread * .4, y + 35, 500 + spread, y + (index % 2 ? 68 : 53));
            guideCtx.stroke();
          });
        } else if (pattern === 'tulip') {
          [
            [500, 355, 175],
            [500, 475, 245],
            [500, 625, 315]
          ].forEach(([x, y, width]) => {
            guideCtx.beginPath();
            guideCtx.moveTo(x - width / 2, y);
            guideCtx.quadraticCurveTo(x - width / 2, y + 135, x, y + 152);
            guideCtx.quadraticCurveTo(x + width / 2, y + 135, x + width / 2, y);
            guideCtx.quadraticCurveTo(x + width * .25, y - 45, x, y + 16);
            guideCtx.quadraticCurveTo(x - width * .25, y - 45, x - width / 2, y);
            guideCtx.stroke();
          });
          guideCtx.beginPath();
          guideCtx.moveTo(500, 775);
          guideCtx.lineTo(500, 385);
          guideCtx.stroke();
        }
        guideCtx.restore();
      }

      function strokeSegment(ctx, stroke, a, b, segmentIndex) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance < .2) return;
        const pieces = Math.max(1, Math.ceil(distance / 14));
        const rand = mulberry32(stroke.seed + segmentIndex * 79 + 13);
        const nx = -dy / distance;
        const ny = dx / distance;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i <= pieces; i++) {
          const t = i / pieces;
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const pressure = a.p + (b.p - a.p) * t;
          const wobble = .9 + Math.sin((stroke.seed + segmentIndex * 8 + i * 2.1)) * .06;
          const width = stroke.width * (.72 + pressure * .44) * wobble * (stroke.tool === 'milk' ? 1.18 : 1);

          if (stroke.tool === 'pin') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
            ctx.lineWidth = Math.max(3.4, width * .32);
            ctx.beginPath();
            ctx.moveTo(x - dx / pieces, y - dy / pieces);
            ctx.lineTo(x, y);
            ctx.stroke();
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowColor = 'rgba(76, 40, 24, .18)';
            ctx.shadowBlur = 7;
            ctx.shadowOffsetY = 2;
            ctx.strokeStyle = 'rgba(72, 35, 21, .13)';
            ctx.lineWidth = width + 12;
            ctx.beginPath();
            ctx.moveTo(x - dx / pieces, y - dy / pieces);
            ctx.lineTo(x, y);
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.globalAlpha = .62;
            ctx.strokeStyle = colors[stroke.color].edge;
            ctx.lineWidth = width + 3;
            ctx.beginPath();
            ctx.moveTo(x - dx / pieces, y - dy / pieces);
            ctx.lineTo(x, y);
            ctx.stroke();

            ctx.globalAlpha = 1;
            ctx.strokeStyle = getFoamPattern(stroke.color);
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x - dx / pieces, y - dy / pieces);
            ctx.lineTo(x, y);
            ctx.stroke();

            ctx.globalAlpha = .13;
            ctx.strokeStyle = colors[stroke.color].highlight;
            ctx.lineWidth = width * .34;
            ctx.beginPath();
            ctx.moveTo(x - dx / pieces - nx * width * .1, y - dy / pieces - ny * width * .1);
            ctx.lineTo(x - nx * width * .1, y - ny * width * .1);
            ctx.stroke();
            ctx.globalAlpha = 1;

            if (i % 2 === 0 && rand() > .22) {
              const bubbleAngle = rand() * Math.PI * 2;
              const offset = (rand() - .5) * width * .68;
              const bx = x + Math.cos(bubbleAngle) * offset;
              const by = y + Math.sin(bubbleAngle) * offset;
              const bubbleSize = weightBubbleSize(width, rand);
              ctx.beginPath();
              ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
              ctx.globalAlpha = .28;
              ctx.fillStyle = colors[stroke.color].highlight;
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            if ((segmentIndex + i) % 3 === 0) {
              [-1, 1].forEach(side => {
                const along = (rand() - .5) * 7;
                const edgeDistance = width * (.42 + rand() * .08);
                const puffX = x + nx * side * edgeDistance + dx / pieces * along * .08;
                const puffY = y + ny * side * edgeDistance + dy / pieces * along * .08;
                ctx.beginPath();
                ctx.arc(puffX, puffY, width * (.035 + rand() * .055), 0, Math.PI * 2);
                ctx.globalAlpha = .1 + rand() * .12;
                ctx.fillStyle = colors[stroke.color].fill;
                ctx.fill();
                ctx.globalAlpha = 1;
              });
            }
          }
        }
        ctx.restore();
      }

      function weightBubbleSize(width, rand) {
        return Math.max(.6, width * (.022 + rand() * .035));
      }

      function paintFoamPath(path, stroke, outlineWidth = 7) {
        milkCtx.save();
        milkCtx.globalCompositeOperation = 'source-over';
        milkCtx.shadowColor = 'rgba(73, 38, 23, .2)';
        milkCtx.shadowBlur = 10;
        milkCtx.shadowOffsetY = 3;
        milkCtx.fillStyle = getFoamPattern(stroke.color);
        milkCtx.fill(path);
        milkCtx.shadowColor = 'transparent';
        milkCtx.shadowBlur = 0;
        milkCtx.shadowOffsetY = 0;
        milkCtx.lineJoin = 'round';
        milkCtx.strokeStyle = 'rgba(91, 48, 28, .17)';
        milkCtx.lineWidth = outlineWidth;
        milkCtx.stroke(path);
        milkCtx.strokeStyle = 'rgba(255, 253, 241, .15)';
        milkCtx.lineWidth = 1.8;
        milkCtx.stroke(path);
        milkCtx.restore();
      }

      function paintFoamLine(path, stroke, width) {
        milkCtx.save();
        milkCtx.globalCompositeOperation = 'source-over';
        milkCtx.lineCap = 'round';
        milkCtx.lineJoin = 'round';
        milkCtx.shadowColor = 'rgba(73, 38, 23, .18)';
        milkCtx.shadowBlur = 8;
        milkCtx.strokeStyle = 'rgba(78, 40, 25, .12)';
        milkCtx.lineWidth = width + 9;
        milkCtx.stroke(path);
        milkCtx.shadowColor = 'transparent';
        milkCtx.shadowBlur = 0;
        milkCtx.strokeStyle = colors[stroke.color].fill;
        milkCtx.globalAlpha = .2;
        milkCtx.lineWidth = width + 7;
        milkCtx.stroke(path);
        milkCtx.strokeStyle = colors[stroke.color].edge;
        milkCtx.globalAlpha = .46;
        milkCtx.lineWidth = width + 3;
        milkCtx.stroke(path);
        milkCtx.globalAlpha = 1;
        milkCtx.strokeStyle = getFoamPattern(stroke.color);
        milkCtx.lineWidth = width;
        milkCtx.filter = 'blur(.22px)';
        milkCtx.stroke(path);
        milkCtx.filter = 'none';
        milkCtx.globalAlpha = .08;
        milkCtx.strokeStyle = colors[stroke.color].highlight;
        milkCtx.lineWidth = width * .3;
        milkCtx.stroke(path);
        milkCtx.restore();
      }

      function makeSmoothPath(points) {
        const path = new Path2D();
        if (points.length < 2) return path;
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const x = (points[i].x + points[i + 1].x) / 2;
          const y = (points[i].y + points[i + 1].y) / 2;
          path.quadraticCurveTo(points[i].x, points[i].y, x, y);
        }
        const last = points[points.length - 1];
        path.lineTo(last.x, last.y);
        return path;
      }

      function renderSnappedHeart(stroke) {
        const { cx, cy, scale: s } = stroke;
        const path = new Path2D();
        path.moveTo(cx, cy + s * .56);
        path.bezierCurveTo(cx - s * .06, cy + s * .47, cx - s * .58, cy + s * .2, cx - s * .58, cy - s * .1);
        path.bezierCurveTo(cx - s * .58, cy - s * .48, cx - s * .17, cy - s * .55, cx, cy - s * .26);
        path.bezierCurveTo(cx + s * .17, cy - s * .55, cx + s * .58, cy - s * .48, cx + s * .58, cy - s * .1);
        path.bezierCurveTo(cx + s * .58, cy + s * .2, cx + s * .06, cy + s * .47, cx, cy + s * .56);
        path.closePath();
        paintFoamPath(path, stroke, 6);

        milkCtx.save();
        milkCtx.clip(path);
        const form = milkCtx.createLinearGradient(cx - s * .48, cy - s * .48, cx + s * .46, cy + s * .5);
        form.addColorStop(0, 'rgba(255, 255, 248, .2)');
        form.addColorStop(.42, 'rgba(255, 250, 236, .015)');
        form.addColorStop(1, 'rgba(118, 70, 42, .07)');
        milkCtx.fillStyle = form;
        milkCtx.fillRect(cx - s, cy - s, s * 2, s * 2);
        milkCtx.restore();

        const shine = new Path2D();
        shine.moveTo(cx - s * .31, cy - s * .22);
        shine.bezierCurveTo(cx - s * .24, cy - s * .39, cx - s * .06, cy - s * .4, cx - s * .02, cy - s * .25);
        milkCtx.save();
        milkCtx.strokeStyle = 'rgba(255, 255, 251, .42)';
        milkCtx.lineWidth = Math.max(2, s * .018);
        milkCtx.lineCap = 'round';
        milkCtx.stroke(shine);

        const groove = new Path2D();
        groove.moveTo(cx, cy - s * .16);
        groove.bezierCurveTo(cx - s * .025, cy + s * .08, cx + s * .018, cy + s * .32, cx, cy + s * .48);
        milkCtx.strokeStyle = 'rgba(105, 61, 37, .16)';
        milkCtx.lineWidth = Math.max(1.2, s * .009);
        milkCtx.stroke(groove);
        milkCtx.restore();
      }

      function renderSnappedLeaf(stroke) {
        const { cx, cy, scale: s } = stroke;
        const stem = new Path2D();
        stem.moveTo(cx + s * .015, cy + s * .62);
        stem.quadraticCurveTo(cx - s * .025, cy, cx, cy - s * .62);
        paintFoamLine(stem, stroke, Math.max(17, s * .08));

        for (let level = 0; level < 6; level++) {
          const y = cy + s * (.4 - level * .145);
          const spread = s * (.16 + level * .045);
          [-1, 1].forEach(side => {
            const leaf = new Path2D();
            const tipX = cx + side * spread;
            const tipY = y - s * (.07 + level * .015);
            leaf.moveTo(cx, y);
            leaf.bezierCurveTo(
              cx + side * spread * .22, y - s * .045,
              cx + side * spread * .7, tipY - s * .035,
              tipX, tipY
            );
            leaf.bezierCurveTo(
              cx + side * spread * .64, tipY + s * .055,
              cx + side * spread * .2, y + s * .055,
              cx, y
            );
            leaf.closePath();
            paintFoamPath(leaf, stroke, 4.5);
          });
        }
      }

      function renderSnappedTulip(stroke) {
        const { cx, cy, scale: s } = stroke;
        const stem = new Path2D();
        stem.moveTo(cx, cy + s * .68);
        stem.quadraticCurveTo(cx + s * .02, cy + s * .26, cx, cy - s * .04);
        paintFoamLine(stem, stroke, Math.max(15, s * .065));

        const petals = [
          { y: cy + s * .38, w: .5, h: .35 },
          { y: cy + s * .08, w: .43, h: .32 },
          { y: cy - s * .24, w: .34, h: .3 }
        ];
        petals.forEach((petal, index) => {
          const path = new Path2D();
          const half = s * petal.w;
          const height = s * petal.h;
          path.moveTo(cx - half, petal.y - height * .08);
          path.bezierCurveTo(
            cx - half * .92, petal.y + height * .58,
            cx - half * .3, petal.y + height * .62,
            cx, petal.y + height * .55
          );
          path.bezierCurveTo(
            cx + half * .3, petal.y + height * .62,
            cx + half * .92, petal.y + height * .58,
            cx + half, petal.y - height * .08
          );
          path.bezierCurveTo(
            cx + half * .52, petal.y - height * .3,
            cx + half * .2, petal.y - height * .2,
            cx, petal.y
          );
          path.bezierCurveTo(
            cx - half * .2, petal.y - height * .2,
            cx - half * .52, petal.y - height * .3,
            cx - half, petal.y - height * .08
          );
          path.closePath();
          paintFoamPath(path, stroke, 5 + index);
        });
      }

      function renderMilkStroke(stroke) {
        if (stroke.tool === 'snap') {
          if (stroke.pattern === 'heart') renderSnappedHeart(stroke);
          if (stroke.pattern === 'leaf') renderSnappedLeaf(stroke);
          if (stroke.pattern === 'tulip') renderSnappedTulip(stroke);
          return;
        }
        if (stroke.points.length < 2) {
          const point = stroke.points[0];
          if (stroke.tool === 'pin') {
            milkCtx.save();
            milkCtx.globalCompositeOperation = 'destination-out';
            milkCtx.beginPath();
            milkCtx.arc(point.x, point.y, Math.max(3, stroke.width * .2), 0, Math.PI * 2);
            milkCtx.fill();
            milkCtx.restore();
          } else {
            milkCtx.save();
            milkCtx.fillStyle = colors[stroke.color].fill;
            milkCtx.beginPath();
            milkCtx.arc(point.x, point.y, stroke.width * .44, 0, Math.PI * 2);
            milkCtx.fill();
            milkCtx.restore();
          }
          return;
        }

        const averagePressure = stroke.points.reduce((sum, point) => sum + point.p, 0) / stroke.points.length;
        const width = stroke.width * (.72 + averagePressure * .44) * 1.18;
        const path = makeSmoothPath(stroke.points);
        if (stroke.tool === 'pin') {
          milkCtx.save();
          milkCtx.globalCompositeOperation = 'destination-out';
          milkCtx.strokeStyle = '#000';
          milkCtx.lineCap = 'round';
          milkCtx.lineJoin = 'round';
          milkCtx.lineWidth = Math.max(3.4, width * .32);
          milkCtx.stroke(path);
          milkCtx.restore();
          return;
        }

        paintFoamLine(path, stroke, width);

        const rand = mulberry32(stroke.seed + 402);
        const spacing = Math.max(5, width * .16);
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const a = stroke.points[i];
          const b = stroke.points[i + 1];
          const distance = Math.hypot(b.x - a.x, b.y - a.y);
          if (distance < spacing) continue;
          const nx = -(b.y - a.y) / distance;
          const ny = (b.x - a.x) / distance;
          const count = Math.floor(distance / spacing);
          for (let j = 0; j < count; j++) {
            const t = (j + 1) / (count + 1);
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            [-1, 1].forEach(side => {
              if (rand() < .22) return;
              const edge = width * (.38 + rand() * .09);
              milkCtx.beginPath();
              milkCtx.arc(
                x + nx * edge * side + (rand() - .5) * width * .1,
                y + ny * edge * side + (rand() - .5) * width * .1,
                width * (.05 + rand() * .07),
                0,
                Math.PI * 2
              );
              milkCtx.globalAlpha = .24 + rand() * .21;
              milkCtx.fillStyle = colors[stroke.color].fill;
              milkCtx.fill();
            });
            if (rand() > .28) {
              milkCtx.beginPath();
              milkCtx.arc(
                x + nx * (rand() - .5) * width * .46,
                y + ny * (rand() - .5) * width * .46,
                Math.max(.8, width * (.03 + rand() * .032)),
                0,
                Math.PI * 2
              );
              milkCtx.globalAlpha = .26 + rand() * .22;
              milkCtx.fillStyle = colors[stroke.color].highlight;
              milkCtx.fill();
            }
            if (rand() > .72) {
              milkCtx.beginPath();
              milkCtx.arc(
                x - nx * (rand() - .5) * width * .58,
                y - ny * (rand() - .5) * width * .58,
                Math.max(.7, width * (.018 + rand() * .022)),
                0,
                Math.PI * 2
              );
              milkCtx.globalAlpha = .1 + rand() * .11;
              milkCtx.fillStyle = colors[stroke.color].edge;
              milkCtx.fill();
            }
          }
        }
        milkCtx.globalAlpha = 1;
      }

      function redrawMilk() {
        milkCtx.clearRect(0, 0, SIZE, SIZE);
        state.strokes.forEach(renderMilkStroke);
        milkCtx.save();
        milkCtx.globalCompositeOperation = 'source-atop';
        milkCtx.globalAlpha = .78;
        milkCtx.drawImage(getFoamSurfaceTexture(), 0, 0);
        milkCtx.restore();
      }

      function pointFromEvent(event) {
        const rect = milkCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (SIZE / rect.width);
        const y = (event.clientY - rect.top) * (SIZE / rect.height);
        const dx = x - SIZE / 2;
        const dy = y - SIZE / 2;
        const inside = dx * dx + dy * dy <= 470 * 470;
        return {
          x: Math.max(8, Math.min(SIZE - 8, x)),
          y: Math.max(8, Math.min(SIZE - 8, y)),
          p: event.pointerType === 'pen' ? Math.max(.12, Math.min(1, event.pressure || .5)) : .52,
          inside
        };
      }

      function beginAudio() {
        if (!state.sound) return;
        if (!audioContext) {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtor) return;
          audioContext = new AudioCtor();
        }
        if (audioContext.state === 'suspended') audioContext.resume();
        if (pourNoise) return;

        const frameCount = audioContext.sampleRate * 1.2;
        const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < frameCount; i++) {
          const white = Math.random() * 2 - 1;
          last = last * .82 + white * .18;
          data[i] = last;
        }
        pourNoise = audioContext.createBufferSource();
        pourNoise.buffer = buffer;
        pourNoise.loop = true;
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 820;
        pourGain = audioContext.createGain();
        pourGain.gain.value = 0;
        pourNoise.connect(filter);
        filter.connect(pourGain);
        pourGain.connect(audioContext.destination);
        pourNoise.start();
      }

      function setPourSound(active) {
        if (!state.sound || !pourGain || !audioContext) return;
        const now = audioContext.currentTime;
        const level = state.tool === 'pin' ? .012 : .035;
        pourGain.gain.cancelScheduledValues(now);
        pourGain.gain.setTargetAtTime(active ? level : 0, now, active ? .07 : .035);
      }

      function snapCurrentStroke(stroke) {
        const bounds = boundsOfPoints(stroke.points);
        const longestGesture = Math.max(bounds.width, bounds.height, stroke.width * 4);
        const scale = clamp(longestGesture * 1.02, 320, 400);
        const marginX = Math.min(355, scale * .72);
        const marginY = Math.min(330, scale * .73);
        const snapped = {
          tool: 'snap',
          pattern: state.pattern,
          color: stroke.color,
          width: stroke.width,
          seed: stroke.seed,
          cx: clamp(bounds.cx, marginX, SIZE - marginX),
          cy: clamp(bounds.cy, marginY, SIZE - marginY),
          scale
        };
        const rawIndex = state.strokes.indexOf(stroke);
        if (rawIndex >= 0) state.strokes.splice(rawIndex, 1);
        state.strokes.push(snapped);
        redrawMilk();
        guideCanvas.style.opacity = '.16';

        const names = { heart: '爱心', leaf: '叶片', tulip: '郁金香' };
        snapFeedback.textContent = `啵！吸附成${names[state.pattern]}`;
        snapFeedback.classList.remove('is-show');
        void snapFeedback.offsetWidth;
        snapFeedback.classList.add('is-show');
      }

      function pointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const point = pointFromEvent(event);
        if (!point.inside) return;
        event.preventDefault();
        activePointerId = event.pointerId;
        coffeeSurface.setPointerCapture(event.pointerId);
        state.drawing = true;
        state.lastPoint = point;
        state.currentStroke = {
          tool: state.tool,
          color: state.color,
          width: state.size,
          seed: Math.floor(Math.random() * 100000),
          points: [point]
        };
        state.strokes.push(state.currentStroke);
        drawHint.classList.add('is-hidden');
        beginAudio();
        setPourSound(true);
        updateControls();
      }

      function pointerMove(event) {
        if (!state.drawing || event.pointerId !== activePointerId || !state.currentStroke) return;
        event.preventDefault();
        const point = pointFromEvent(event);
        if (!point.inside) return;
        const distance = Math.hypot(point.x - state.lastPoint.x, point.y - state.lastPoint.y);
        if (distance < 2.4) return;
        state.currentStroke.points.push(point);
        strokeSegment(milkCtx, state.currentStroke, state.lastPoint, point, state.currentStroke.points.length - 1);
        state.lastPoint = point;
      }

      function pointerUp(event) {
        if (!state.drawing || (event.pointerId !== activePointerId && activePointerId !== null)) return;
        const finishedStroke = state.currentStroke;
        state.drawing = false;
        state.currentStroke = null;
        state.lastPoint = null;
        activePointerId = null;
        setPourSound(false);
        if (finishedStroke) {
          if (
            finishedStroke.tool === 'pin'
            && state.autoSnap
            && state.pattern !== 'free'
            && finishedStroke.points.length >= 2
          ) {
            snapCurrentStroke(finishedStroke);
          } else {
            finishedStroke.points = smoothPoints(finishedStroke.points);
            redrawMilk();
          }
        }
        updateControls();
      }

      function updateControls() {
        const count = state.strokes.length;
        strokeCount.textContent = count + ' 笔触';
        undoButton.disabled = count === 0;
        clearButton.disabled = count === 0;
        sizeValue.textContent = String(state.size);
        sizeLabel.textContent = state.tool === 'milk' ? '奶泡粗细' : '针尖力度';
        sizeRange.setAttribute('aria-label', state.tool === 'milk' ? '奶泡粗细' : '针尖力度');
      }

      function undo() {
        if (!state.strokes.length) return;
        state.strokes.pop();
        redrawMilk();
        updateControls();
        showToast('轻轻退后一步，刚好。');
      }

      function clearCup() {
        if (!state.strokes.length) return;
        state.strokes = [];
        redrawMilk();
        drawHint.classList.remove('is-hidden');
        updateControls();
        showToast('新的一杯，重新开始。');
      }

      function setTool(tool) {
        state.tool = tool;
        document.querySelectorAll('[data-tool]').forEach(button => {
          button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
        });
        updateControls();
      }

      function setColor(color) {
        state.color = color;
        document.querySelectorAll('[data-color]').forEach(button => {
          button.setAttribute('aria-pressed', String(button.dataset.color === color));
        });
      }

      function setPattern(pattern) {
        state.pattern = pattern;
        document.querySelectorAll('[data-pattern]').forEach(button => {
          button.setAttribute('aria-pressed', String(button.dataset.pattern === pattern));
        });
        patternStatus.textContent = patternNames[pattern];
        guideCanvas.style.opacity = pattern === 'free' ? '0' : '.85';
        drawGuide(pattern);
        updateSnapControl();
      }

      function updateSnapControl() {
        snapState.textContent = state.autoSnap ? 'ON' : 'OFF';
        if (!state.autoSnap) {
          snapHint.textContent = '修整关闭，保留手绘线条';
        } else if (state.pattern === 'free') {
          snapHint.textContent = '先选一个图案模板再雕花';
        } else {
          snapHint.textContent = `松手吸附成${patternNames[state.pattern].replace('模板', '')}`;
        }
      }

      function showToast(message) {
        clearTimeout(state.toastTimer);
        toast.textContent = message;
        toast.classList.add('is-visible');
        state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1900);
      }

      function calculateScore() {
        scoreSurfaceCtx.clearRect(0, 0, SIZE, SIZE);
        scoreSurfaceCtx.drawImage(milkCanvas, 0, 0);
        const pixels = scoreSurfaceCtx.getImageData(0, 0, SIZE, SIZE).data;
        const step = 7;
        let totalSamples = 0;
        let coveredSamples = 0;
        let sumX = 0;
        let sumY = 0;
        let left = 0;
        let right = 0;
        let top = 0;
        let bottom = 0;

        for (let y = 30; y < SIZE; y += step) {
          for (let x = 30; x < SIZE; x += step) {
            const dx = x - SIZE / 2;
            const dy = y - SIZE / 2;
            if (dx * dx + dy * dy > 455 * 455) continue;
            totalSamples++;
            const alpha = pixels[(y * SIZE + x) * 4 + 3];
            if (alpha < 18) continue;
            coveredSamples++;
            sumX += x;
            sumY += y;
            if (x < SIZE / 2) left++;
            else right++;
            if (y < SIZE / 2) top++;
            else bottom++;
          }
        }

        if (coveredSamples === 0) {
          return {
            total: 0,
            coverage: 0,
            balance: 0,
            pattern: 0,
            title: '空杯哲学家',
            copy: '咖啡面还很干净，先落下第一笔奶泡吧。'
          };
        }

        const coverage = coveredSamples / totalSamples * 100;
        const avgX = sumX / coveredSamples;
        const avgY = sumY / coveredSamples;
        const distance = Math.hypot(avgX - SIZE / 2, avgY - SIZE / 2) / 455;
        const asymmetry = Math.abs(left - right) / coveredSamples;

        const coverageScore = clamp(100 - Math.abs(coverage - 11) * 4.4 - Math.max(0, coverage - 24) * 1.8, 12, 100);
        const balanceScore = clamp(100 - asymmetry * 105, 42, 100);
        const centerScore = clamp(100 - distance * 95, 22, 100);
        const snapped = state.strokes.some(stroke => stroke.tool === 'snap');
        let patternScore;
        if (state.pattern === 'free') {
          patternScore = clamp(57 + state.strokes.length * 5, 57, 82);
        } else {
          patternScore = snapped ? 95 : clamp(62 + state.strokes.length * 3, 62, 82);
        }
        const total = Math.round(
          coverageScore * .27
          + balanceScore * .24
          + centerScore * .2
          + patternScore * .29
        );

        let title;
        let copy;
        if (total >= 90) {
          title = '奶泡小天才';
          copy = '奶泡轻得像云，图案也乖乖落在了杯子中央。';
        } else if (total >= 78) {
          title = '小馆新星';
          copy = '这一杯已经有模有样，再添一点细节就更漂亮了。';
        } else if (total >= 62) {
          title = '温柔抽象派';
          copy = '线条很有自己的脾气，咖啡师说可爱就够啦。';
        } else {
          title = '自由灵魂画手';
          copy = '比例有点随性，但每一笔都被这杯咖啡记住了。';
        }

        return {
          total,
          coverage: Math.round(coverageScore),
          balance: Math.round(balanceScore),
          pattern: Math.round(patternScore),
          title,
          copy
        };
      }

      function animateScore(value) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
          scoreValue.textContent = String(value);
          return;
        }
        const started = performance.now();
        const duration = 620;
        function frame(now) {
          const progress = Math.min(1, (now - started) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          scoreValue.textContent = String(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      function updateScoreUI(result) {
        state.lastScore = result.total;
        const filledStars = result.total >= 90 ? 3 : result.total >= 76 ? 2 : result.total >= 60 ? 1 : 0;
        scoreStars.innerHTML = [0, 1, 2]
          .map(index => `<span class="${index < filledStars ? 'is-filled' : ''}">${index < filledStars ? '★' : '☆'}</span>`)
          .join('');
        scoreStars.setAttribute('aria-label', `获得${filledStars}颗星`);
        scoreTitle.textContent = result.title;
        scoreCopy.textContent = result.copy;
        scoreCoverageValue.textContent = String(result.coverage);
        scoreBalanceValue.textContent = String(result.balance);
        scorePatternValue.textContent = String(result.pattern);
        scoreCoverageBar.style.width = '0%';
        scoreBalanceBar.style.width = '0%';
        scorePatternBar.style.width = '0%';
        animateScore(result.total);
        requestAnimationFrame(() => {
          scoreCoverageBar.style.width = `${result.coverage}%`;
          scoreBalanceBar.style.width = `${result.balance}%`;
          scorePatternBar.style.width = `${result.pattern}%`;
        });
      }

      function patternRect(ctx, x, y, width, height, radius, fill) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }

      function buildArtwork() {
        const output = document.createElement('canvas');
        output.width = 1200;
        output.height = 1200;
        const ctx = output.getContext('2d');

        ctx.fillStyle = '#f2dfb5';
        ctx.fillRect(0, 0, 1200, 1200);
        ctx.save();
        ctx.globalAlpha = .12;
        ctx.strokeStyle = '#6b3925';
        ctx.lineWidth = 2;
        for (let x = -1200; x < 2400; x += 72) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x - 1200, 1200);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 1200, 1200);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(600, 585);
        ctx.rotate(-.025);
        ctx.shadowColor = 'rgba(75, 42, 28, .22)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 28;
        ctx.beginPath();
        ctx.ellipse(0, 0, 510, 485, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f5e7cf';
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(935, 585, 170, 188, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f8eacf';
        ctx.strokeStyle = '#f8eacf';
        ctx.lineWidth = 64;
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(74, 40, 25, .33)';
        ctx.stroke();
        ctx.restore();

        const cx = 600;
        const cy = 585;
        const outerRadius = 395;
        const coffeeRadius = 318;

        ctx.save();
        ctx.shadowColor = 'rgba(75, 42, 28, .24)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 16;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius + 18, 0, Math.PI * 2);
        ctx.fillStyle = '#f8ecd4';
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, coffeeRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(coffeeCanvas, cx - coffeeRadius, cy - coffeeRadius, coffeeRadius * 2, coffeeRadius * 2);
        ctx.drawImage(milkCanvas, cx - coffeeRadius, cy - coffeeRadius, coffeeRadius * 2, coffeeRadius * 2);
        const coffeeShade = ctx.createRadialGradient(cx - 80, cy - 130, 30, cx, cy, coffeeRadius);
        coffeeShade.addColorStop(0, 'rgba(255,255,255,.04)');
        coffeeShade.addColorStop(.72, 'rgba(40,20,12,0)');
        coffeeShade.addColorStop(1, 'rgba(40,20,12,.35)');
        ctx.fillStyle = coffeeShade;
        ctx.fillRect(cx - coffeeRadius, cy - coffeeRadius, coffeeRadius * 2, coffeeRadius * 2);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.lineWidth = 36;
        ctx.strokeStyle = '#fbf3e2';
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(74, 40, 25, .35)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 22, cy - 24, outerRadius + 18, Math.PI * 1.05, Math.PI * 1.72);
        ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(255, 255, 255, .65)';
        ctx.stroke();
        ctx.restore();

        patternRect(ctx, 148, 84, 170, 56, 28, '#5b3527');
        ctx.fillStyle = '#fff2d6';
        ctx.font = '500 23px "DM Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO. 07', 233, 120);

        patternRect(ctx, 850, 84, 202, 56, 28, '#db8580');
        ctx.fillStyle = '#fff4d9';
        ctx.font = '500 22px "DM Mono", monospace';
        ctx.fillText(`${state.lastScore || 0} PTS`, 951, 120);

        ctx.save();
        ctx.translate(635, 1040);
        ctx.rotate(-.02);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4b2d22';
        ctx.font = '400 68px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
        ctx.fillText('MILK & BLOOM', 0, 0);
        ctx.font = '500 18px "DM Mono", monospace';
        ctx.letterSpacing = '4px';
        ctx.fillStyle = '#74503e';
        ctx.fillText('A LITTLE LATTE MADE WITH LOVE', 0, 40);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(1012, 1040, 39, 0, Math.PI * 2);
        ctx.fillStyle = '#db8580';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4b2d22';
        ctx.stroke();
        ctx.fillStyle = '#fff4d9';
        ctx.font = '400 30px "ZCOOL KuaiLe", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♡', 1012, 1052);

        return output;
      }

      async function saveArtworkToAlbum() {
        if (state.saving) return;
        const miniTool = window.xhs && window.xhs.miniTool;
        if (!miniTool || typeof miniTool.saveImageToPhotosAlbum !== 'function') {
          showToast('请在小红书 App 内打开后再保存到相册。');
          return;
        }

        state.saving = true;
        downloadButton.disabled = true;
        downloadLabel.textContent = '保存中…';
        try {
          let filePath = resultImage.src;
          if (typeof miniTool.writeTempFile === 'function') {
            const tempFile = await miniTool.writeTempFile({ data: filePath });
            if (tempFile && tempFile.filePath) filePath = tempFile.filePath;
          }
          await miniTool.saveImageToPhotosAlbum({ filePath });
          downloadLabel.textContent = '已保存到相册';
          showToast('这杯拉花已经装进相册啦。');
        } catch (error) {
          downloadLabel.textContent = '保存失败，请重试';
          showToast('保存失败，请检查相册权限后重试。');
        } finally {
          state.saving = false;
          downloadButton.disabled = false;
          setTimeout(() => {
            if (resultModal.classList.contains('is-open')) {
              downloadLabel.textContent = '保存到相册';
            }
          }, 1800);
        }
      }

      function openResult() {
        if (state.strokes.length === 0) {
          showToast('先画一点奶泡，再把这杯咖啡端上来。');
          return;
        }
        const score = calculateScore();
        updateScoreUI(score);
        const artwork = buildArtwork();
        const dataUrl = artwork.toDataURL('image/png');
        resultImage.src = dataUrl;
        downloadLabel.textContent = '保存到相册';
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric' });
        resultDate.textContent = formatter.format(now);
        state.modalOpener = document.activeElement;
        resultModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => modalClose.focus(), 60);
      }

      function closeResult() {
        resultModal.classList.remove('is-open');
        document.body.style.overflow = '';
        if (state.modalOpener && state.modalOpener.focus) state.modalOpener.focus();
      }

      function trapModalFocus(event) {
        if (event.key !== 'Tab' || !resultModal.classList.contains('is-open')) return;
        const focusable = resultModal.querySelectorAll('button, a[href]');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      coffeeSurface.addEventListener('pointerdown', pointerDown);
      coffeeSurface.addEventListener('pointermove', pointerMove);
      coffeeSurface.addEventListener('pointerup', pointerUp);
      coffeeSurface.addEventListener('pointercancel', pointerUp);
      coffeeSurface.addEventListener('lostpointercapture', pointerUp);
      coffeeSurface.addEventListener('contextmenu', event => event.preventDefault());

      document.querySelectorAll('[data-tool]').forEach(button => {
        button.addEventListener('click', () => setTool(button.dataset.tool));
      });
      document.querySelectorAll('[data-color]').forEach(button => {
        button.addEventListener('click', () => setColor(button.dataset.color));
      });
      document.querySelectorAll('[data-pattern]').forEach(button => {
        button.addEventListener('click', () => setPattern(button.dataset.pattern));
      });

      sizeRange.addEventListener('input', () => {
        state.size = Number(sizeRange.value);
        updateControls();
      });
      autoSnapToggle.addEventListener('change', () => {
        state.autoSnap = autoSnapToggle.checked;
        updateSnapControl();
        showToast(state.autoSnap ? '图案吸附已打开。' : '图案吸附已关闭，保留手绘线条。');
      });
      undoButton.addEventListener('click', undo);
      clearButton.addEventListener('click', clearCup);
      saveButton.addEventListener('click', openResult);
      downloadButton.addEventListener('click', saveArtworkToAlbum);
      modalClose.addEventListener('click', closeResult);
      continueButton.addEventListener('click', closeResult);
      resultModal.addEventListener('click', event => {
        if (event.target === resultModal) closeResult();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && resultModal.classList.contains('is-open')) closeResult();
        trapModalFocus(event);
        if (event.key === 'z' && (event.metaKey || event.ctrlKey) && !resultModal.classList.contains('is-open')) {
          event.preventDefault();
          undo();
        }
      });

      soundButton.addEventListener('click', () => {
        state.sound = !state.sound;
        soundButton.setAttribute('aria-pressed', String(state.sound));
        soundButton.setAttribute('aria-label', state.sound ? '关闭拉花音效' : '打开拉花音效');
        if (!state.sound) setPourSound(false);
        const icon = soundButton.querySelector('svg');
        icon.dataset.icon = state.sound ? 'sound-on' : 'sound-off';
        icon.innerHTML = state.sound
          ? '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>'
          : '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 5M21 9l-5 5"/>';
      });

      drawCoffee();
      drawGuide('free');
      updateSnapControl();
      updateControls();
    })();
