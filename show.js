const createDataDisplay = function() {
  const dataDiv = document.body.appendChild(document.createElement("div"));
  dataDiv.style.zIndex = 2;
  dataDiv.style.position = "absolute";
  dataDiv.style.bottom = 0;
  dataDiv.style.left = 0;
  dataDiv.style.maxWidth = "75%";
  dataDiv.style.margin = "1rem";
  const dataTitleP = dataDiv.appendChild(document.createElement("p"));
  dataTitleP.style.font = "1.5em helvetica, sans-serif";
  dataTitleP.style.margin = 0;
  const dataTitleA = dataTitleP.appendChild(document.createElement("a"));
  dataTitleA.target = "_blank";
  dataTitleA.rel = "noreferrer noopener";
  dataTitleA.className = "primaryLink";
  const dataFlairP = document.createElement("p");
  dataFlairP.style.font = "1em helvetica, sans-serif";
  dataFlairP.style.margin = 0;
  const dataSubP = dataDiv.appendChild(document.createElement("p"));
  dataSubP.style.font = "1em verdana, sans-serif";
  dataSubP.style.margin = 0;
  dataSubP.style.color = "var(--primary-minor)";
  const dataSubA = dataSubP.appendChild(document.createElement("a"));
  dataSubA.target = "_blank";
  dataSubA.rel = "noreferrer noopener";
  dataSubA.className = "secondaryLink";
  return {
    set: function(content) {
      dataTitleA.innerHTML = content.title.replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/\'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
      dataTitleA.href = content.permalink;
      dataSubA.innerText = "/r/" + content.subreddit;
      dataSubA.href = "https://www.reddit.com/r/" + content.subreddit;
      if (content.flair) {
        dataFlairP.innerText = content.flair;
        dataDiv.insertBefore(dataFlairP, dataSubP);
      }
      else if (dataFlairP.parentNode === dataDiv)
        dataDiv.removeChild(dataFlairP);
    }
  };
};

const createTimeDisplay = function(size=256) {
  let progress = 0;
  let pause = false;
  let number = null;
  const css = getComputedStyle(document.body);
  const pMaj = css.getPropertyValue("--primary-major");
  const pMin = css.getPropertyValue("--primary-minor");
  const sMaj = css.getPropertyValue("--secondary-major");
  const sMin = css.getPropertyValue("--secondary-minor");
  const canvas = document.body.appendChild(document.createElement("canvas"));
  canvas.width = size;
  canvas.height = size;
  canvas.style.position = "absolute";
  canvas.style.zIndex = 1;
  canvas.style.bottom = 0;
  canvas.style.right = 0;
  canvas.style.margin = "1rem";
  canvas.style.width = "5rem";
  canvas.style.height = "5rem";
  const ctx = canvas.getContext("2d");
  const r1 = size / 2;
  const r2 = r1 * 7/12;
  const r3 = r2 + (r1 - r2) / 4;
  const r4 = r2 + (r1 - r2) / 2;
  const r5 = r1 / 2;
  const easeQuad = t => t < 1/2 ? 2*t*t : -1+(4-2*t)*t;
  const easeCube = t => t < 1/2 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
  const easeQuadIn = t => t*t;
  const easeCubeIn = t => t*t*t;
  const easeQuadOut = t => t*(2-t);
  const easeCubeOut = t => (--t)*t*t+1;
  const easeSineIn = t => -Math.cos(t*(Math.PI/2))+1;
  const easeSineOut = t => Math.sin(t*(Math.PI/2));
  const crown = function(color, inner, outer, t1, t2, pointMult=.2) {
    const o = size / 2;
    const angle = t => 2 * Math.PI * (t - 1/4);
    const x = (r, t) => o + r * Math.cos(angle(t));
    const y = (r, t) => o + r * Math.sin(angle(t));
    const mid = (inner + outer) / 2;
    const pointT = (outer - inner) / o * pointMult;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(o, o, outer, angle(t1-pointT/2), angle(t2-pointT/2), false);
    ctx.lineTo(x(mid, t2+pointT/2), y(mid, t2+pointT/2));
    ctx.lineTo(x(inner, t2-pointT/2), y(inner, t2-pointT/2));
    ctx.arc(o, o, inner, angle(t2-pointT/2), angle(t1-pointT/2), true);
    ctx.lineTo(x(mid, t1+pointT/2), y(mid, t1+pointT/2));
    ctx.closePath();
    ctx.fill();
  };
  const setProgress = (elapsed, dur) => progress = Math.min(elapsed / dur, 1);
  const drawProgress = function() {
    const f = t => (--t)*t*t+1;
    crown(sMin, r4, r1, 0, (easeSineIn(progress) + progress) / 2, 0);
    crown(pMin, r3, r4, 0, progress);
    crown(pMaj, r2, r3, 0, (easeSineOut(progress) + progress) / 2);
  };
  const drawPause = function() {
    const margin = size / 4;
    const barWidth = (size - 2 * margin) / 3;
    ctx.fillStyle = pMin;
    ctx.fillRect(margin, margin, barWidth, size-2*margin);
    ctx.fillRect(size-margin-barWidth, margin, barWidth, size-2*margin);
  };
  const drawNumber = function() {
    ctx.fillStyle = pMaj;
    ctx.font = "" + Math.round(size * 5/12) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("" + number, size / 2, size / 2);
  };
  let progressAnimID = 0;
  const animateProgress = function(progressStart, duration) {
    progressAnimID += 1;
    const safeguard = progressAnimID;
    const orig = performance.now();
    window.requestAnimationFrame(function cb() {
      if (progressAnimID !== safeguard) return;
      setProgress(performance.now() - orig + progressStart, duration);
      draw();
      window.requestAnimationFrame(cb);
    });
  };
  let loadingAnimID = 0;
  const activeLoadingAnims = [];
  let loadingAnimOrig = 0;
  const loadingAnimLoopTime = 1250;
  const animateLoading = function() {
    loadingAnimID += 1;
    activeLoadingAnims.push(loadingAnimID);
    if (activeLoadingAnims.length === 1) {
      loadingAnimOrig = performance.now();
      window.requestAnimationFrame(function cb() {
        if (!activeLoadingAnims.length) return;
        draw();
        window.requestAnimationFrame(cb);
      });
    }
    return loadingAnimID;
  };
  const stopLoadingAnimation = function(animID) {
    if (activeLoadingAnims.indexOf(animID) !== -1)
      activeLoadingAnims.splice(activeLoadingAnims.indexOf(animID), 1);
  };
  const drawLoading = function() {
    let t1 = (performance.now() - loadingAnimOrig) / loadingAnimLoopTime;
    let t2 = (performance.now() - loadingAnimOrig) / (loadingAnimLoopTime*1.5);
    while (t1 > 1) t1 -= 1;
    while (t2 > 1) t2 -= 1;
    if (t1 <= 1/2)
      crown(sMaj, r5, r2, t2, t2 + easeQuad(2 * t1));
    else
      crown(sMaj, r5, r2, t2 + easeCube(2 * t1 - 1), 1 + t2);
  };
  const draw = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (pause ? drawPause : drawProgress)();
    if (activeLoadingAnims.length)
      drawLoading();
    if (number !== null)
      drawNumber();
  };
  return {
    setProgress: setProgress,
    pause: function() {
      pause = true;
      progressAnimID += 1;
      draw();
    },
    resume: () => pause = false,
    resume: function(elapsed, duration) {
      pause = false;
      animateProgress(elapsed, duration);
    },
    setNumber: function(n) {
      number = n;
      draw();
    },
    removeNumber: () => number = null,
    draw: draw,
    animateProgress: animateProgress,
    animateLoading: animateLoading,
    stopLoadingAnimation: stopLoadingAnimation
  };
};
