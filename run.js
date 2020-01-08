/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and put video on top of z-index
*/

/*let startX = 0;
document.addEventListener("touchstart", function(evt) {
  document.getElementById("errorLog").textContent = "start " + evt.touches[0].clientX + " / " + window.innerWidth;
  startX = evt.touches[0].clientX;
}, false);
document.addEventListener("touchmove", function(evt) {
  document.getElementById("errorLog").textContent = "move " + evt.touches[0].clientX + " / " + window.innerWidth;
  if (startX - evt.touches[0].clientX > window.innerWidth / 4) {
    const p = document.createElement("p");
    p.textContent = "SWIPE";
    document.getElementById("settings").appendChild(p);
  }
}, false);*/

const createEventStack = function() {
  let nextEvents = [];
  let prevEvents = [];
  const notice = () => document.dispatchEvent(new Event("okBoomer"));
  window.addEventListener("keyup", function(evt) {
    if ([" ", "Spacebar", "ArrowRight", "Right"].indexOf(evt.key) !== -1) {
      nextEvents.push(Date.now());
      nextEvents.sort();
      notice();
    }
    else if (["Backspace", "ArrowLeft", "Left"].indexOf(evt.key) !== -1) {
      prevEvents.push(Date.now());
      prevEvents.sort();
      notice();
    }
  });
  document.addEventListener("touchstart", function(evt) {
    nextEvents.push(Date.now());
    nextEvents.sort();
    notice();
  }, false);
  const waitForEvent = () => new Promise((res, rej) => {
    if (nextEvents.length || prevEvents.length) {
      res({ skip: nextEvents.length - prevEvents.length, pause: false });
      nextEvents = [];
      prevEvents = [];
      noticeMe = false;
    }
    else
      document.addEventListener("okBoomer", function cb() {
        document.removeEventListener("okBoomer", cb);
        waitForEvent().then(res, rej);
      });
  });
  return {
    waitForEvent: waitForEvent
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
  const act = content => new Promise((res, rej) => {
    timeDisplay.set(0, setup.actDuration);
    if (setup.reverse) timeDisplay.setNumber(programme.reversePosition());
    (programme.isEnd() ? timeDisplay.pause : timeDisplay.resume)();
    timeDisplay.draw();
    media.set(content);
    dataDisplay.set(content);
    stack.waitForEvent().then(function hdl(evt) {
      let skip = 0;
      const f = n => new Promise((res, rej) => {
        let p = Promise.resolve();
        if (n > 0 && !programme.isEnd()) {
          p = p.then(() => programme.next(cnt => { skip++; return cnt }));
        }
        else if (n < 0 && !programme.isStart()) {
          skip--;
          p = p.then(programme.prev);
        }
        if (Math.abs(n) > 1) p = p.then(() => f(n - Math.sign(n)));
        else if (n === 0) p = p.then(programme.current);
        p = p.then(res, rej);
      });
      return Promise.race([f(evt.skip), stack.waitForEvent().then(hdl)])
        .then(content => skip ? act(content) : stack.waitForEvent().then(hdl));
    }).then(res, rej);
  });
  programme.gather().then(programme.next).then(act).then(res, rej);
});

// window.onload = () => setUpTheShow().then(runTheShow).catch(console.log);
window.onload = () => {
  const btn = document.body.appendChild(document.createElement("button"));
  btn.innerHTML = "start touch<br>event test";
  btn.style.font = "3em monospace";
  btn.addEventListener("click", function cb() {
    btn.removeEventListener("click", cb);
    let nTouches = 0;
    const copyTouch = touch => ({ id: touch.identifier, sX: touch.screenX,
      sY: touch.screenY, cX: touch.clientX, cY: touch.clientY,
      px: touch.pageX, pY: touch.pageY });
    const logTouch = t => "id: " + t.id + ", screen: " + Math.round(t.sX) +
      " " + Math.round(t.sY) + ", client: " + Math.round(t.cX) + " " +
      Math.round(t.cY) + ", page: " + Math.round(t.pX) + " " +
      Math.round(t.pY);
    let tStart = copyTouch({});
    let tMove = copyTouch({});
    let tEnd = copyTouch({});
    let tCancel = copyTouch({});
    const p = document.body.appendChild(document.createElement("p"));
    p.style.font = "1.2em monospace";
    p.style.maxWidth = "" + Math.round(window.innerWidth) + "px";
    const log = function() {
      p.innerHTML = "window: " + Math.round(window.innerWidth) + ", ";
      p.innerHTML += Math.round(window.innerHeight) + "<br>";
      p.innerHTML += logTouch(tStart) + "<br>";
      p.innerHTML += logTouch(tMove) + "<br>";
      p.innerHTML += logTouch(tEnd) + "<br>";
      p.innerHTML += logTouch(tCancel) + "<br>";
    };
    log();
    document.addEventListener("touchstart", function(evt) {
      tStart = copyTouch(evt.changedTouches[0]); log(); }, false);
    document.addEventListener("touchmove", function(evt) {
      tMove = copyTouch(evt.changedTouches[0]); log(); }, false);
    document.addEventListener("touchend", function(evt) {
      tEnd = copyTouch(evt.changedTouches[0]); log(); }, false);
    document.addEventListener("touchcancel", function(evt) {
      tCancel = copyTouch(evt.changedTouches[0]); log(); }, false);
  });
  setUpTheShow().then(runTheShow).catch(console.log);
};
