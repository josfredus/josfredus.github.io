/* CONTROLS
next slide: spacebar, right arrow, swipe left
prev slide: backspace, left arrow, swipe right
pause: enter, p, down arrow, escape, double-tap
resume: enter, p, down arrow, up arrow, double-tap
put in foreground: pause by double-tap or by escape
put in background: resume
*/

const createEventStack = function(media) {
  const notice = () => document.dispatchEvent(new Event("okBoomer"));
  const trigger = function(evts) {
    evts.push(performance.now());
    evts.sort();
    notice();
  };
  const connectKeyUp = function(keys) {
    let evts = [];
    window.addEventListener("keydown", evt => {
      if (keys.indexOf(evt.key) !== -1)
        evt.preventDefault();
    });
    window.addEventListener("keyup", evt => {
      if (keys.indexOf(evt.key) !== -1) {
        evt.preventDefault();
        trigger(evts);
      }
    });
    return evts;
  };
  let nextEvents = connectKeyUp([" ", "Spacebar", "ArrowRight", "Right"]);
  let prevEvents = connectKeyUp(["Backspace", "ArrowLeft", "Left"]);
  const triggerNext = () => trigger(nextEvents);
  const triggerPrev = () => trigger(prevEvents);
  let toggleEvents = connectKeyUp(["Enter", "p", "P", "ArrowDown", "Down"]);
  let showEvents = [];
  let pauseEvents = [];
  window.addEventListener("keyup", evt => {
    if (evt.key === "Escape") {
      if (media.isForeground())
        trigger(toggleEvents);
      else {
        trigger(pauseEvents);
        trigger(showEvents);
      }
    }
  });
  let resumeEvents = connectKeyUp(["ArrowUp", "Up"]);
  let startX = 0;
  let swipe = false;
  let lastTap = { t: null, x: null, y: null };
  const doubleTapInterval = 1000;
  const doubleTapRadius = Math.max(window.innerWidth, window.innerHeight) / 5;
  document.addEventListener("touchstart", function(evt) {
    startX = evt.changedTouches[0].clientX;
    swipe = false;
    const dx = lastTap.x === null ? 0 : 
      evt.changedTouches[0].clientX - lastTap.x;
    const dy = lastTap.y === null ? 0 :
      evt.changedTouches[0].clientY - lastTap.y;
    if (lastTap.t !== null &&
        performance.now() - lastTap.t <= doubleTapInterval &&
        dx * dx + dy * dy <= doubleTapRadius * doubleTapRadius) {
      lastTap.t = null;
      trigger(toggleEvents);
      trigger(showEvents);
    }
    else {
      lastTap.t = performance.now();
      lastTap.x = evt.changedTouches[0].clientX;
      lastTap.y = evt.changedTouches[0].clientY;
    }      
  }, false);
  document.addEventListener("touchmove", function(evt) {
    if (swipe) return;
    const threshold = Math.min(window.innerWidth, window.innerHeight) / 4;
    const x = evt.changedTouches[0].clientX;
    if (Math.abs(x - startX) >= threshold) {
      swipe = true;
      trigger(x - startX > 0 ? prevEvents : nextEvents);
    }
  }, false);
  let timeoutID = 0;
  const setupTimeout = function(delay) {
    timeoutID += 1;
    const safeguard = timeoutID;
    window.setTimeout(function() {
      if (safeguard === timeoutID)
        trigger(nextEvents);
    }, delay);
  };
  let waitID = 0;
  const waitForEvent = () => new Promise((res, rej) => {
    if (nextEvents.length || prevEvents.length || showEvents.length ||
        toggleEvents.length || pauseEvents.length || resumeEvents.length) {
      const evts = [];
      const store = function(xevts, n) {
        while (xevts.length)
          evts.push({ t: xevts.shift(), n: n});
      };
      store(nextEvents, "next");
      store(prevEvents, "prev");
      store(showEvents, "show");
      store(toggleEvents, "toggle");
      store(pauseEvents, "pause");
      store(resumeEvents, "resume");
      evts.sort((a, b) => a.t - b.t);
      res(evts);
    }
    else {
      waitID += 1;
      const safeguard = waitID;
      document.addEventListener("okBoomer", function cb() {
        document.removeEventListener("okBoomer", cb);
        if (waitID !== safeguard) return res([]);
        waitForEvent().then(res, rej);
      });
    }
  });
  const getSkip = function(evts) {
    let n = 0;
    evts.forEach(function(evt) {
      if (evt.n === "next") n++;
      else if (evt.n === "prev") n--;
    });
    return n;
  };
  const getTogglePause = function(evts, pause) {
    let toggle = false;
    evts.forEach(function(evt) {
      if (evt.n === "toggle") toggle = !toggle;
      else if (evt.n === "pause") toggle = !pause;
      else if (evt.n === "resume") toggle = pause;
    });
    return toggle;
  };
  const getNeedVisibility = function(evts, pause) {
    if (pause && getTogglePause(evts, pause)) return false;
    let need = false;
    evts.forEach(evt => { if (evt.n === "show") need = true; });
    return need;
  };
  return {
    waitForEvent: waitForEvent,
    getSkip: getSkip,
    getTogglePause: getTogglePause,
    getNeedVisibility: getNeedVisibility,
    setupTimeout: setupTimeout,
    cancelTimeout: () => timeoutID += 1,
    triggerNext: triggerNext,
    triggerPrev: triggerPrev
  };
};

const runTheShow = (setup, timeDisplay) => new Promise((res, rej) => {
  document.body.style.overflow = "hidden";
  document.body.removeChild(document.getElementById("settings"));
  const programme = createProgramme(setup, timeDisplay);
  const dataDisplay = createDataDisplay();
  const media = createMediaHandler(setup, timeDisplay);
  const stack = createEventStack(media);
  let pause = false;
  let tStart = 0;
  let tElapsed = 0;
  const act = (content, from="next") => new Promise((res, rej) => {
    console.log(content.title);
    dataDisplay.set(content);
    timeDisplay.setProgress(0, setup.actDuration);
    timeDisplay.setNumber(programme.reversePosition());
    tStart = performance.now();
    tElapsed = 0;
    let actDuration = setup.actDuration;
    let mediaIsPlaying = false;
    media.update(programme)
      .then(duration => {
        actDuration = duration;
        media.play().then(() => {
          mediaIsPlaying = true;
          tStart = performance.now();
          tElapsed = 0;
          if (!pause) {
            stack.setupTimeout(duration);
            timeDisplay.animateProgress(0, duration);
          }
          else media.showControls();
        }).catch(() => {
          media.goForeground();
          pause = true;
          timeDisplay.setProgress(0, duration);
          timeDisplay.pause();
          media.setOnPlay(() => {
            media.goBackground();
            mediaIsPlaying = true;
            tStart = performance.now();
            tElapsed = 0;
            pause = false;
            stack.setupTimeout(duration);
            timeDisplay.resume();
            timeDisplay.animateProgress(0, duration);
          });
        });
      }).catch(error => {
        if (error === "nocontent") {
          const crt = programme.getCurrentIndex();
          if (crt >= programme.getEndIndex()) stack.triggerPrev();
          else if (crt <= programme.getStartIndex()) stack.triggerNext();
          else if (from === "next") stack.triggerNext();
          else if (from === "prev") stack.triggerPrev();
        }
      });
    stack.waitForEvent().then(function hdl(evts) {
      let nSkip = stack.getSkip(evts);
      let togglePause = stack.getTogglePause(evts, pause);
      let needVisibility = stack.getNeedVisibility(evts, pause);
      let outOfBorderSkip = false;
      if (!pause && ((programme.isStart() && nSkip < 0) ||
          (programme.isEnd() && nSkip > 0))) {
        togglePause = true;
        outOfBorderSkip = true;
      }
      if (programme.isEnd() && nSkip > 0 && !pause)
        togglePause = true;
      if ((programme.isStart() && nSkip<0) || (programme.isEnd() && nSkip>0))
        nSkip = 0;
      if (nSkip)
        stack.cancelTimeout();
      if (needVisibility)
        media.goForeground();
      if (togglePause && pause) {
        pause = false;
        timeDisplay.resume();
        media.goBackground();
        if (mediaIsPlaying) {
          tStart = performance.now();
          stack.setupTimeout(actDuration - tElapsed);
          timeDisplay.animateProgress(tElapsed, actDuration);
          media.rectifyCurrentTime(tElapsed);
        }
      }
      else if (togglePause && !pause) {
        pause = true;
        timeDisplay.pause();
        media.showControls();
        tElapsed += performance.now() - tStart;
        stack.cancelTimeout();
        if (outOfBorderSkip) {
          tElapsed = 0;
          timeDisplay.setProgress(0, actDuration);
          timeDisplay.draw();
        }
      }
      let skipped = 0;
      const skip = n => new Promise((res, rej) => {
        let p = null;
        if (n > 0 && !programme.isEnd())
          p = programme.next(cnt => { skipped++; return cnt });
        else if (n < 0 && !programme.isStart())
          p = programme.prev().then(cnt => { skipped--; return cnt });
        else
          p = programme.current();
        if (Math.abs(n) > 1)
          p = p.then(() => skip(n - Math.sign(n)));
        p = p.then(res, rej);
      });
      return (nSkip ?
          Promise.race([skip(nSkip), stack.waitForEvent().then(hdl)]) :
          stack.waitForEvent().then(hdl))
        .then(cnt => skipped ?
          act(cnt, nSkip > 0 ? "next" : "prev") :
          stack.waitForEvent().then(hdl));
    }).then(res, rej);
  });
  programme.gather().then(programme.next).then(act).then(res, rej);
});

window.onload = function() {
  const timeDisplay = createTimeDisplay();
  setUpTheShow(timeDisplay)
    .then(setup => runTheShow(setup, timeDisplay))
    .catch(console.log);
};
