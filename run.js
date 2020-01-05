const runTheShow = setup => new Promise((res, rej) => {
  // document.body.style.overflow = "hidden";
  // document.body.scroll = "no";
  document.body.style.margin = 0 // remove after testing it's in css already
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  
  timeDisplay.set(22.1, 30);
  timeDisplay.setNumber(28);
  timeDisplay.draw();
  const xtr = new ContentExtractor("aww");
  xtr.getNextContent().then(content => {
    media.set(content);
    dataDisplay.set(content);
  }).catch(console.log("BARREN"));
});

// window.onload = () => setUpTheShow().then(launchSlideshow).catch(console.log);
window.onload = () => runTheShow({});
// window.onload = () => setUpTheShow().then(console.log, console.log);
