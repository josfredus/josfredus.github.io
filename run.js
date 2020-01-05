/* CONTROLS
next slide: spacebar, swipe left
prev slide: backspace, swipe right
pause / resume: enter, double-tap
  also makes video controls appear and put video on top of z-index
*/

const runTheShow = setup => new Promise((res, rej) => {
  console.log(setup); // if setup.reverse gather all content
  document.body.style.overflow = "visible";
  document.body.removeChild(document.getElementById("settings"));
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  
  timeDisplay.set(15, 30);
  timeDisplay.setNumber(28);
  timeDisplay.draw();
  setup.xtrs[0].getNextContent().then(content => {
    media.set(content);
    dataDisplay.set(content);
  });
});

// window.onload = () => setUpTheShow().then(launchSlideshow).catch(console.log);
// window.onload = () => runTheShow({});
// window.onload = () => setUpTheShow().then(console.log, console.log);
window.onload = () => setUpTheShow().then(runTheShow).catch(console.log);
