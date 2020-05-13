const https = s => s.slice(0, 5) === "http:" ? "https" + s.slice(4) : s;
const imgRegExps = [/\.jpg$/, /\.jpeg$/, /\.png$/, /\.bmp$/, /\.gif$/];
const gfyRegExps = [/gfycat\.com\/[A-Za-z]+$/, /redgifs\.com\/[A-Za-z]+$/,
  /gfycat\.com\/gifs\/detail\/[A-Za-z]+$/];

const extractContentSource = post => new Promise((res, rej) => {
  if (imgRegExps.some(re => re.test(post.url))) {
    res({ src: https(post.url), type: "img" });
  }
  else if (/\.gifv$/.test(post.url)) {
    res({
      src: [".mp4", ".webm"].map(x => https(post.url.replace(/\.\w+$/, x))),
      type: "video"
    });
  }
  else if (/\/\/v\.redd\.it\//.test(post.url)) {
    if (post.media && post.media.reddit_video) 
      res({
        src: [https(post.media.reddit_video.fallback_url)],
        type: "video"
      });
    else
      rej(post);
  }
  else if (gfyRegExps.some(re => re.test(post.url))) {
    const id = post.url.match(/\/([A-Za-z]+)$/)[1];
    const r = new XMLHttpRequest();
    r.responseType = "json";
    r.open("GET", "https://api.gfycat.com/v1/gfycats/" + id);
    r.addEventListener("error", rej);
    r.addEventListener("abort", rej);
    r.addEventListener("load", function() {
      const sources = [];
      if (r.response && r.response.gfyItem && r.response.gfyItem.mp4Url)
        sources.push(https(r.response.gfyItem.mp4Url));
      if (r.response && r.response.gfyItem && r.response.gfyItem.webmUrl)
        sources.push(https(r.response.gfyItem.webmUrl));
      if (sources.length > 0)
        res({ src: sources, type: "video" });
      else
        rej();
    });
    r.send();
  }
  else
    rej(post);
});

const ContentExtractor = function(subreddit, sorting="hot", period="") {
  this.subreddit = subreddit;
  this.sorting = sorting;
  this.period = period;
  this.contents = [];
  this.listing = [];
  this.after = "";
  this.exhausted = false;
  this.i = null;
  this.barren = false;
  this.consecutiveEmptyListings = 0;
};

ContentExtractor.prototype.loadNextContent =
function() { return (that => new Promise((res, rej) => {
  const subIsExhausted = function() {
    that.exhausted = true;
    that.barren = that.contents.length === 0;
    that.loadNextContent().then(res, rej);
  };
  if (that.barren || that.exhausted)
    res();
  else if (that.listing.length) {
    const post = that.listing.shift();
    extractContentSource(post)
      .then(source => {
        const content = {
          permalink: "https://www.reddit.com" + post.permalink,
          title: post.title,
          author: post.author,
          flair: post.author_flair_text,
          subreddit: that.subreddit,
          created: new Date(post.created_utc * 1000),
          type: source.type,
          src: source.src
        };
        that.consecutiveEmptyListings = 0;
        that.contents.push(content);
        res();
      })
      .catch(() => {
        that.loadNextContent().then(res, rej);
      });
  }
  else if (that.consecutiveEmptyListings < 5) {
    const r = new XMLHttpRequest();
    r.responseType = "json";
    r.open("GET", "https://www.reddit.com/r/" + that.subreddit + "/" +
      that.sorting + ".json?limit=100&t=" + that.period + "&after=" +
      that.after);
    r.addEventListener("load", function() {
      if (r.response.data && r.response.data.children &&
          r.response.data.children.length) {
        that.listing = that.listing.concat(
          r.response.data.children.map(child => child.data));
        that.after = that.listing.slice(-1)[0].name;
        that.consecutiveEmptyListings += 1;
        that.loadNextContent().then(res, rej);
      }
      else
        subIsExhausted();
    });
    r.addEventListener("abort", subIsExhausted);
    r.addEventListener("error", subIsExhausted);
    r.send();
  }
  else
    subIsExhausted();
}))(this)};

ContentExtractor.prototype.withdrawContent =
function() { return (that => new Promise((res, rej) => {
  if (that.barren)
    res(null);
  else if (that.exhausted) {
    that.i = that.i === null ? 0 : that.i + 1;
    that.i = that.i >= that.contents.length ? 0 : that.i;
    res(that.contents[that.i]);
  }
  else if (!that.contents.length ||
           (that.i !== null && that.i >= that.contents.length - 1))
    that.loadNextContent().then(() => that.withdrawContent()).then(res, rej);
  else {
    that.i = that.i === null ? 0 : that.i + 1;
    res(that.contents[that.i]);
  }
}))(this)};

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

const createProgramme = function(setup, nPreload = 20) {
  const contents = [];
  let current = -1;
  const getEndIndex = function() {
    if (!setup.reverse || setup.reverseLoop) return Infinity;
    let result = setup.xtrs.length * setup.reverseStart - 1;
    while (result >= 0) {
      if (!contents[result] || !contents[result].cursed) return result;
      result--;
    }
    return result;
  };
  const getStartIndex = function() {
    let result = 0;
    let end = getEndIndex();
    while (result < contents.length && result <= end) {
      if (contents[result] && !contents[result].cursed) return result;
      result++;
    }
    return result;
  };
  const isEnd = () => current >= getEndIndex();
  const isStart = () => current <= getStartIndex();
  const iGen = indexGen(setup.xtrs.length, setup.shuffle);
  const preload = function() {
    const n = contents.length;
    contents.push(Promise.resolve(n > 0 ? contents[n - 1] : null)
      .then(() => setup.xtrs[iGen.next().value].withdrawContent())
      .then(content => { contents[n] = content; return content; }));
  };
  const startPreloading = () => new Promise((res, rej) => {
    preload();
    Promise.resolve(contents[0]).then(res, rej);
    for (let i = 1; i < nPreload; i++) preload();
  });
  const nextStd = (p = Promise.resolve()) => new Promise((res, rej) => {
    if (contents.length - current <= nPreload + 1) preload();
    current++;
    Promise.resolve(contents[current]).then(
      content => content.cursed ? nextStd(p) : Promise.resolve(content).then(p)
    ).then(res, rej);
  });
  const reverseTops = [];
  const reverse = () => new Promise((res, rej) => {
    const getTopN = xtr => new Promise((res, rej) => {
      const result = [];
      const f = () => new Promise((res, rej) => {
        if (result.length < setup.reverseStart)
          xtr.withdrawContent().then(function(content) {
            if (xtr.exhausted && content === result[0])
              return res();
            result.push(content);
            f().then(res, rej);
          });
        else
          res();
      });
      f().then(function() {
        result.reverse();
        for (let i = result.length; i < setup.reverseStart; i++)
          result.push(result.slice(-1)[0]);
        res(result);
      }, rej);
    });
    Promise.all(setup.xtrs.map(getTopN)).then(function(tops) {
      tops.forEach(t => reverseTops.push(t));
      res();
    });
  });
  const nextRvr = (p = Promise.resolve()) => new Promise((res, rej) => {
    if (!isEnd()) {
      current += 1;
      if (current >= contents.length)
        contents.push(reverseTops[iGen.next().value][
          Math.floor(current / reverseTops.length) % setup.reverseStart]);
    }
    Promise.resolve(contents[current]).then(p).then(res, rej);
  });
  const gather = setup.reverse ? reverse : startPreloading;
  const next = setup.reverse ? nextRvr : nextStd;
  const prev = () => new Promise((res, rej) => {
    current--;
    while (current > 0 && contents[current].cursed) current--;
    res(contents[current]);
  });
  const getContent = index => new Promise((res, rej) => {
    if (index < 0 ||
        (setup.reverse && !setup.reverseLoop &&
          index >= setup.xtrs.length * setup.reverseStart))
      return res(Promise.resolve(null));
    if (index < contents.length) return res(Promise.resolve(contents[index]));
    if (setup.reverse)
      for (let i = contents.length; i <= index; i++)
        contents.push(reverseTops[iGen.next().value][
          Math.floor(i / reverseTops.length) % setup.reverseStart]);
    else
      for (let i = contents.length - 1; i < index; i++) preload();
    res(Promise.resolve(contents[index]));
  });
  return {
    contents: () => contents,
    current: () => current === -1 ? null : contents[current],
    next: next,
    prev: prev,
    gather: gather,
    isEnd: isEnd,
    isStart: isStart,
    reversePosition: () => setup.reverse ? (setup.reverseStart -
      Math.floor(current / setup.xtrs.length) % setup.reverseStart) : null,
    curse: index => contents[index].cursed = true,
    getCurrentIndex: () => current,
    getEndIndex: getEndIndex,
    getStartIndex: getStartIndex,
    getContent: getContent
  };
};
