const runTheShow = setup => new Promise((res, rej) => {
  document.body.style.overflow = "hidden";
  document.body.scroll = "no";
  const dataDisplay = createDataDisplay();
  const timeDisplay = createTimeDisplay();
  const media = createMedia();
  
  timeDisplay.set(22.1, 30);
  timeDisplay.setNumber(28);
  timeDisplay.pause();
  timeDisplay.draw();
  const xtr = new ContentExtractor("aww");
  xtr.getNextContent().then(media.set).catch(console.log("BARREN"));
});

//window.onload = () => setUpTheShow().then(launchSlideshow).catch(console.log);
window.onload = () => runTheShow({});
