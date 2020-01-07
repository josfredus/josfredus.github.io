/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and put video on top of z-index
*/

const nextActEvent = () => new Promise((res, rej) => {
  window.addEventListener("keyup", function cb(event) {
    if ([" ", "Spacebar"].indexOf(event.key) !== -1) {
      window.removeEventListener("keyup", cb);
      res("nextAct");
    }
  });
  let x = null;
  document.addEventListener("touchstart", function cb(evt) {
    window.removeEventListener("touchstart", cb);
    evt.preventDefault();
  }, false);
  document.addEventListener("touchend", function cb(evt) {
    window.removeEventListener("touchend", cb);
    evt.preventDefault();
  }, false);
  /*
  let startX = 0;
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
});

const prevActEvent = () => new Promise((res, rej) => {
  window.addEventListener("keyup", function cb(event) {
    if (["Backspace"].indexOf(event.key) !== -1) {
      window.removeEventListener("keyup", cb);
      res("prevAct");
    }
  });
});

const createEventStack = function() {
  const nextEvents = [];
  const prevEvents = [];
  window.addEventListener("keyup", function(evt) {
    if ([" ", "Spacebar", "ArrowRight", "Right"].indexOf(evt.key) !== -1) {
      nextEvents.push(evt.timeStamp);
      nextEvents.sort();
    }
    else if (["Backspace", "ArrowLeft", "Left"].indexOf(evt.key) !== -1) {
      prevEvents.push(evt.timeStamp);
      prevEvents.sort();
    }
  });
  window.addEventListener("touchstart", function(evt) {
    nextEvents.push(evt.timeStamp);
    nextEvents.sort();
  }, false);
  return {
    test: () => nextEvents.length
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
    console.log(programme.contents().length, stack.test()+1);
    timeDisplay.set(0, setup.actDuration);
    if (setup.reverse) timeDisplay.setNumber(programme.reversePosition());
    (programme.isEnd() ? timeDisplay.pause : timeDisplay.resume)();
    timeDisplay.draw();
    media.set(content);
    dataDisplay.set(content);
    const events = [];
    if (!programme.isEnd()) events.push(nextActEvent());
    if (!programme.isStart()) events.push(prevActEvent());
    Promise.race(events).then(function(name) {
      if (name === "nextAct")
        return programme.next().then(act);
      if (name === "prevAct")
        return programme.prev().then(act);
    });
  });
  programme.gather().then(programme.next).then(act).then(res, rej);
});

window.onload = () => setUpTheShow().then(runTheShow).catch(console.log);
