/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and puts content on top of z-index
*/

const createEventStack = function() {
  const notice = () => document.dispatchEvent(new Event("okBoomer"));
  const connectKeyUp = function(keys) {
    let evts = [];
    window.addEventListener("keyup", evt => {
      if (keys.indexOf(evt.key) !== -1) {
        evts.push(performance.now());
        evts.sort();
        notice();
      }
    });
    return evts;
  };
  let nextEvents = connectKeyUp([" ", "Spacebar", "ArrowRight", "Right"]);
  let prevEvents = connectKeyUp(["Backspace", "ArrowLeft", "Left"]);
  let pauseEvents = connectKeyUp(["Enter", "p", "P", "ArrowDown", "Down"]);
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
      pauseEvents.push(performance.now());
      pauseEvents.sort();
      notice();
    }
    else {
      lastTap.t = performance.now();
      lastTap.x = evt.changedTouches[0].clientX;
      lastTap.y = evt.changedTouches[0].clientY;
    }      
  }, false);
  document.addEventListener("touchmove", function(evt) {
    if (swipe) return;
    const threshold = window.innerWidth / 4;
    const x = evt.changedTouches[0].clientX;
    if (Math.abs(x - startX) >= threshold) {
      swipe = true;
      const evts = x - startX > 0 ? prevEvents : nextEvents;
      evts.push(performance.now());
      evts.sort();
      notice();
    }
  }, false);
  let timeoutID = 0;
  const setupTimeout = function(delay) {
    timeoutID += 1;
    const safeguard = timeoutID;
    window.setTimeout(function() {
      if (safeguard === timeoutID) {
        nextEvents.push(performance.now())
        nextEvents.sort()
        notice();
      }
    }, delay);
  };
  const waitForEvent = () => new Promise((res, rej) => {
    if (nextEvents.length || prevEvents.length ||
        pauseEvents.length || resumeEvents.length) {
      const evts = [];
      const store = function(xevts, n) {
        while (xevts.length)
          evts.push({ t: xevts.shift(), n: n});
      };
      store(nextEvents, "next");
      store(prevEvents, "prev");
      store(pauseEvents, "pause");
      store(resumeEvents, "resume");
      evts.sort((a, b) => a.t - b.t);
      res(evts);
    }
    else
      document.addEventListener("okBoomer", function cb() {
        document.removeEventListener("okBoomer", cb);
        waitForEvent().then(res, rej);
      });
  });
  const getSkip = evts => {
    let n = 0;
    evts.forEach(function(evt) {
      if (evt.n === "next") n++;
      else if (evt.n === "prev") n--;
    });
    return n;
  };
  const getTogglePause = (evts, pause) => {
    let toggle = false;
    evts.forEach(function(evt) {
      if (evt.n === "pause") toggle = !toggle;
      else if (evt.n === "resume") toggle = pause;
    });
    return toggle;
  };
  return {
    waitForEvent: waitForEvent,
    getSkip: getSkip,
    getTogglePause: getTogglePause,
    setupTimeout: setupTimeout,
    cancelTimeout: () => timeoutID += 1
  };
};

const runTheShow = setup => new Promise((res, rej) => {
  document.body.style.overflow = "hidden";
  document.body.removeChild(document.getElementById("settings"));
  const programme = createProgramme(setup);
  const stack = createEventStack();
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  const load = content => new Promise((res, rej) => {
    media.set(content);
    content.duration = setup.actDuration;
    res(content);
  });
  let pause = false;
  let tStart = 0;
  let tElapsed = 0;
  const act = content => new Promise((res, rej) => {
    tStart = performance.now();
    tElapsed = 0;
    dataDisplay.set(content);
    if (setup.reverse)
      timeDisplay.setNumber(programme.reversePosition());
    if (programme.isEnd()) {
      pause = true;
      timeDisplay.pause();
    }
    if (!pause) {
      stack.setupTimeout(content.duration);
      timeDisplay.animateProgress(0, content.duration);
    }
    stack.waitForEvent().then(function hdl(evts) {
      let nSkip = stack.getSkip(evts);
      let togglePause = stack.getTogglePause(evts, pause);
      if (togglePause && pause && !programme.isEnd()) {
        pause = false;
        tStart = performance.now();
        stack.setupTimeout(content.duration - tElapsed);
        timeDisplay.resume(tElapsed, content.duration);
      }
      else if (togglePause && !pause && !programme.isEnd()) {
        pause = true;
        tElapsed += performance.now() - tStart;
        stack.cancelTimeout();
        timeDisplay.pause();
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
      const p = nSkip ?
        Promise.race([skip(nSkip), stack.waitForEvent().then(hdl)]) :
        stack.waitForEvent().then(hdl);
      return p.then(load) // maybe put load in a race
        .then(cnt => skipped ? act(cnt) : stack.waitForEvent().then(hdl));
    }).then(res, rej);
  });
  programme.gather().then(programme.next).then(load).then(act).then(res, rej);
});

window.onload = () => setUpTheShow().then(runTheShow).catch(console.log);
