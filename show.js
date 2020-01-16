const Z_MEDIA_UNDER = 0;
const Z_DESCRIPTION = 1;
const Z_MEDIA_OVER = 2;
const Z_TIME_DISPLAY = 3;

const createDescribeFunction = function(sortingPeriod = "") {
  const div = document.getElementById("description");
  div.style.display = "block";
  div.style.zIndex = Z_DESCRIPTION;
  const title = document.getElementById("title");
  const author = document.getElementById("author");
  const flair = document.getElementById("flair");
  const sub = document.getElementById("sub");
  const date = document.getElementById("date");
  return cnt => {
    title.innerHTML = cnt.title.replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;").replace(/\'/g,"&#39;").replace(/\//g,"&#x2F;");
    title.href = cnt.permalink;
    author.textContent = "/u/" + cnt.author;
    author.href = "https://www.reddit.com/user/" + cnt.author + "/posts/";
    flair.textContent = cnt.flair ? "(" + cnt.flair + ")" : "";
    sub.textContent = "/r/" + cnt.subreddit;
    sub.href = "https://www.reddit.com/r/" + cnt.subreddit;
    const now = new Date(Date.now());
    const elapsed = now - cnt.created;
    const minutesAgo = elapsed / 1000 / 60;
    const hoursAgo = minutesAgo / 60;
    const ago = (n, s) => "" + Math.round(n) + " " + s +
      (Math.round(n) > 1 ? "s" : "") + " ago";
    const midnight = now - ((now.getHours() * 60 + now.getMinutes()) * 60 +
      now.getSeconds()) * 1000 - now.getMilliseconds();
    const daysAgo = Math.ceil((midnight - cnt.created) / 1000 / 60 / 60 / 24);
    if (minutesAgo < 1)
      date.textContent = "just now";
    else if (minutesAgo < 60)
      date.textContent = ago(minutesAgo, "minute");
    else if (hoursAgo < 24)
      date.textContent = ago(hoursAgo, "hour");
    else if ((daysAgo <= 31 && ["year","all"].indexOf(sortingPeriod) === -1) ||
        (daysAgo >= 7 && sortingPeriod === ""))
      date.textContent = daysAgo === 1 ? "yesterday" : ago(daysAgo, "day");
    else if (cnt.created.getFullYear() === now.getFullYear())
      date.textContent = "on " +
        cnt.created.toLocaleString("default", { month: "long" }) +
        " " + cnt.created.getDate();
    else
      date.textContent = "on " +
        cnt.created.toLocaleString("default", { month: "short" }) +
        " " + cnt.created.getDate() + " " + cnt.created.getFullYear();
  };
};

const createTimepiece = function(size=256) {
  let progress = 0;
  let pause = false;
  let number = null;
  const css = getComputedStyle(document.body);
  const pMaj = css.getPropertyValue("--primary-major");
  const pMin = css.getPropertyValue("--primary-minor");
  const sMaj = css.getPropertyValue("--secondary-major");
  const sMin = css.getPropertyValue("--secondary-minor");
  const canvas = document.getElementById("timepiece");
  canvas.style.display = "block";
  canvas.width = size;
  canvas.height = size;
  canvas.style.zIndex = Z_TIME_DISPLAY;
  const ctx = canvas.getContext("2d");
  const r1 = size / 2;
  const r2 = r1 * 7/12;
  const r3 = r2 + (r1 - r2) / 4;
  const r4 = r2 + (r1 - r2) / 2;
  const r5 = r1 / 2;
  const easeQuad = t => t < 1/2 ? 2*t*t : -1+(4-2*t)*t;
  const easeCube = t => t < 1/2 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
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
    ctx.fillStyle = sMaj;
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
    draw();
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
    drawProgress();
    if (activeLoadingAnims.length) drawLoading();
    if (pause) drawPause();
    if (number !== null) drawNumber();
  };
  return {
    setProgress: setProgress,
    pause: function() {
      pause = true;
      progressAnimID += 1;
      draw();
    },
    resume: () => pause = false,
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

const createMediaHandler = function(setup, tp, preload = 2, tAbort = 6000) {
  let media = null;
  let foreground = false;
  const isImage = () => media instanceof HTMLImageElement;
  const isVideo = () => media instanceof HTMLVideoElement;
  const fit = function() {
    if (media) {
      const width = isImage() ? media.naturalWidth : media.videoWidth;
      const height = isImage() ? media.naturalHeight : media.videoHeight;
      const a = window.innerWidth / width;
      const b = window.innerHeight / height;
      const r = Math.min(a, b);
      media.style.width = "" + Math.ceil(width * r) + "px";
      media.style.height = "" + Math.ceil(height * r) + "px";
      media.style.left = "" +
        Math.round((window.innerWidth - width * r) / 2) + "px";
      media.style.top = "" +
        Math.round((window.innerHeight - height * r) / 2) + "px";
    }
  };
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  const load = content => new Promise((res, rej) => {
    if (!content) return rej();
    const elm = document.createElement(content.type);
    elm.style.position = "absolute";
    elm.style.zIndex = Z_MEDIA_UNDER;
    if (content.type === "img") {
      elm.src = content.src;
      res(elm);
    }
    else
      loadVideo(content, elm).then(res, rej);
  });
  const loadVideo = (content, elm) => new Promise((res, rej) => {
    content.src.forEach(function(src) {
      const srcElm = document.createElement("source");
      srcElm.src = src;
      elm.appendChild(srcElm);
    });
    elm.controls = false;
    elm.loop = true;
    let loaded = false;
    let aborted = false;
    elm.addEventListener("canplay", function cb() {
      elm.removeEventListener("canplay", cb);
      if (!aborted) {
        loaded = true;
        res(elm);
      }
    });
    window.setTimeout(function() {
      if (!loaded) {
        aborted = true;
        rej();
      }
    }, tAbort);
  });
  const computeDuration = function() {
    let duration = setup.actDuration;
    if (isVideo()) {
      duration = media.duration * 1000;
      if (setup.loop !== "noloop") {
        while (duration <= setup.actDuration - media.duration * 1000)
          duration += media.duration * 1000;
        if (duration < setup.actDuration) {
          if (setup.loop === "cutloop")
            duration = setup.actDuration;
          else if (setup.loop === "overloop")
            duration += media.duration * 1000;
        }
      }
    }
    return duration;
  };
  let preloaded = [];
  let updateID = 0;
  const update = programme => new Promise((res, rej) => {
    const crt = programme.getCurrentIndex();
    for (let i = 0; i <= Math.max(crt + preload, preloaded.length - 1); i++) {
      if (crt - preload <= i && i <= crt + preload) {
        if (!preloaded[i]) {
          preloaded[i] = programme.getContent(i)
            .then(content => new Promise((res, rej) => {
              if (!content || content.cursed) return res(null);
              load(content).then(res).catch(() => {
                content.cursed = true;
                res(null);
              });
            }));
        }
      }
      else {
        Promise.resolve(preloaded[i]).then(function(elm) {
          if (!elm) return;
          if (elm instanceof HTMLVideoElement) {
            while (elm.firstChild) 
              elm.removeChild(elm.firstChild);
            elm.load();
          }
          else
            elm.src = "";
        }).catch(e => null);
        preloaded[i] = null;
      }
    }
    const animID = tp.animateLoading();
    updateID += 1;
    const safeguard = updateID;
    Promise.resolve(preloaded[crt]).then(elm => {
      tp.stopLoadingAnimation(animID);
      if (updateID !== safeguard) return rej("expired");
      if (!elm) return rej("nocontent");
      if (media !== null) {
        if (isVideo()) {
          media.pause();
          media.currentTime = 0;
        }
        document.body.removeChild(media);
      }
      media = elm;
      document.body.appendChild(media);
      fit();
      if (isImage()) media.onload = fit;
      (foreground ? goForeground : goBackground)();
      res(computeDuration());
    });
  });
  const play = () => new Promise((res, rej) => {
    if (isImage()) res();
    else if (isVideo()) media.play().then(res, rej);
    else rej();
  });
  const showControls = function() {
    if (isVideo()) media.controls = true;
  };
  const hideControls = function() {
    if (isVideo()) media.controls = false;
  };
  const goForeground = function() {
    foreground = true;
    if (!media) return;
    media.style.zIndex = Z_MEDIA_OVER;
    showControls();
  };
  const goBackground = function() {
    foreground = false;
    if (!media) return;
    media.style.zIndex = Z_MEDIA_UNDER;
    hideControls();
  };
  const setOnPlay = f => {
    if (!media || !isVideo()) return;
    media.addEventListener("play", function cb() {
      media.removeEventListener("play", cb);
      f();
    });
  };
  const rectifyCurrentTime = function(elapsed) {
    if (!isVideo() || !media || !media.duration) return;
    media.currentTime = elapsed/1000 -
      Math.floor(elapsed/1000 / media.duration) * media.duration;
  };
  return {
    update: update,
    isImage: isImage,
    isVideo: isVideo,
    play: play,
    showControls: showControls,
    hideControls: hideControls,
    goForeground: goForeground,
    goBackground: goBackground,
    setOnPlay: setOnPlay,
    rectifyCurrentTime: rectifyCurrentTime,
    isForeground: () => foreground
  };
};
