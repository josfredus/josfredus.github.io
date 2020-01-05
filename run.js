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

const runTheShow = setup => new Promise((res, rej) => {
  console.log(setup); // if setup.reverse gather all content
  document.body.style.overflow = "visible";
  document.body.removeChild(document.getElementById("settings"));
  const iGen = indexGen(setup.xtrs.length, setup.shuffle);
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  const nextActInput = () => new Promise((res, rej) => {
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
  const act = content => new Promise((res, rej) => {
    timeDisplay.set(0, setup.actDuration);
    timeDisplay.draw();
    media.set(content);
    dataDisplay.set(content);
    nextActInput().then(() => setup.xtrs[iGen.next().value].getNextContent())
      .then(act);
  });
  setup.xtrs[iGen.next().value].getNextContent().then(act).then(res, rej);
});

// window.onload = () => setUpTheShow().then(launchSlideshow).catch(console.log);
// window.onload = () => runTheShow({});
// window.onload = () => setUpTheShow().then(console.log, console.log);
window.onload = () => setUpTheShow().then(runTheShow)
  .then(console.log).catch(console.log);
