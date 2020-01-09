/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and put video on top of z-index
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
  let pauseEvents = connectKeyUp(["Enter", "P", "ArrowDown", "Down"]);
  let resumeEvents = connectKeyUp(["ArrowUp", "Up"]);
  let startX = 0;
  let swipe = false;
  document.addEventListener("touchstart", function(evt) {
    startX = evt.changedTouches[0].clientX;
    swipe = false;
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
  const waitForEvent = () => new Promise((res, rej) => {
    if (nextEvents.length || prevEvents.length) {
      const skip = nextEvents.length - prevEvents.length;
      while (nextEvents.length) nextEvents.pop();
      while (prevEvents.length) prevEvents.pop();
      res({ skip: skip, pause: false });
    }
    else
      document.addEventListener("okBoomer", function cb() {
        document.removeEventListener("okBoomer", cb);
        waitForEvent().then(res, rej);
      });
  });
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
  return {
    waitForEvent: waitForEvent,
    setupTimeout: setupTimeout
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
  const act = content => new Promise((res, rej) => {
    dataDisplay.set(content);
    if (setup.reverse) timeDisplay.setNumber(programme.reversePosition());
    (programme.isEnd() ? timeDisplay.pause : timeDisplay.resume)();
    const orig = performance.now();
    window.requestAnimationFrame(function cb() {
      const t = (performance.now() - orig) / 1000;
      timeDisplay.set(t, content.duration);
      timeDisplay.draw();
      if (t < content.duration && content === programme.current())
        window.requestAnimationFrame(cb);
    });
    stack.setupTimeout(content.duration * 1000);
    stack.waitForEvent().then(function hdl(evt) {
      let skip = 0;
      const f = n => new Promise((res, rej) => {
        let p = null;
        if (n > 0 && !programme.isEnd())
          p = programme.next(cnt => { skip++; return cnt });
        else if (n < 0 && !programme.isStart())
          p = programme.prev().then(cnt => { skip--; return cnt });
        else
          p = programme.current();
        if (Math.abs(n) > 1)
          p = p.then(() => f(n - Math.sign(n)));
        p = p.then(res, rej);
      });
      return Promise.race([f(evt.skip), stack.waitForEvent().then(hdl)])
        .then(load) // maybe put load in a race
        .then(content => skip ? act(content) : stack.waitForEvent().then(hdl));
    }).then(res, rej);
  });
  programme.gather().then(programme.next).then(load).then(act).then(res, rej);
});

window.onload = () => setUpTheShow().then(runTheShow).catch(console.log);
