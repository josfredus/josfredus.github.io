/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and put video on top of z-index
*/

const indexGen = function*(n, shuffle) {
	const indexes = [...Array(n)].map((x, i) => i);
	const init = function() {
		if (shuffle)
			for (let i = n - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[indexes[i], indexes[j]] = [indexes[j], indexes[i]];
			}
    return 0;
	};
	let p = init();
	while (true) {
		yield indexes[p];
    p = p < n - 1 ? p + 1 : init();
	}
};

const createProgramme = function(setup) {
  const contents = [];
  const remember = content => { contents.push(content); return content; };
  let current = -1;
  const iGen = indexGen(setup.xtrs.length, setup.shuffle);
  const next = () => new Promise((res, rej) => {
    current += 1;
    if (contents.length === 0 || current === contents.length) 
      setup.xtrs[iGen.next().value].getNextContent().then(remember)
        .then(res, rej);
    else
      res(contents[current]);
  });
  const reverse = () => new Promise((res, rej) => {
    const getTopN = xtr => new Promise((res2, rej2) => {
      const result = [];
      const f = () => new Promise((res3, rej3) => {
        if (result.length < setup.reverseStart)
          xtr.getNextContent().then(function(content) {
            if (xtr.exhausted && content === result[0])
              return res3();
            result.push(content);
            return f().then(res3, rej3);
          });
        else
          return res3();
      });
      f().then(function() {
        result.reverse()
        for (let i = result.length; i < setup.reverseStart; i++)
          result.push(result.slice(-1)[0]);
        return res2(result);
      }, rej2);
    });
    Promise.all(setup.xtrs.map(getTopN)).then(function(tops) {
      tops.forEach(function(t, i) {
        setup.xtrs[i].exhausted = true;
        while (setup.xtrs[i].contents.length) setup.xtrs[i].contents.pop();
        t.forEach(content => setup.xtrs[i].contents.push(content));
      });
      res();
    });
  });
  const gather = setup.reverse ? reverse : () => Promise.resolve();
  return {
    contents: () => contents,
    current: () => current === -1 ? null : contents[current],
    next: next,
    gather: gather,
    ended: () => setup.reverse && !setup.reverseLoop &&
      current >= setup.xtrs.length * setup.reverseStart - 1
  };
};

const nextActEvent = () => new Promise((res, rej) => {
  window.addEventListener("keyup", function cb(event) {
    if ([" ", "Spacebar"].indexOf(event.key) !== -1) {
      window.removeEventListener("keyup", cb);
      res("nextAct");
    }
  });
  window.addEventListener("touchstart", function cb(event) {
    window.removeEventListener("touchstart", cb);
    res("nextAct");
  });
});

const runTheShow = setup => new Promise((res, rej) => {
  document.body.style.overflow = "visible";
  document.body.removeChild(document.getElementById("settings"));
  const programme = createProgramme(setup);
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  const act = content => new Promise((res, rej) => {
    timeDisplay.set(0, setup.actDuration);
    timeDisplay.draw();
    media.set(content);
    dataDisplay.set(content);
    if (!programme.ended())
      nextActEvent().then(programme.next).then(act);
  });
  programme.gather().then(programme.next).then(act).then(res, rej);
});

window.onload = () => setUpTheShow().then(runTheShow)
  .then(console.log).catch(console.log);
