const https = s => s.slice(0, 5) === "http:" ? "https" + s.slice(4) : s;
const imgRegExps = [/\.jpg$/, /\.jpeg$/, /\.png$/, /\.bmp$/, /\.gif$/];
const gfyRegExps = [/gfycat\.com\/[A-Za-z]+$/,
  /gfycat\.com\/gifs\/detail\/[A-Za-z]+$/];

const extractContentSource = post => new Promise((res, rej) => {
  if (imgRegExps.some(re => re.test(post.url))) {
    res({ src: https(post.url), type: "img" });
  }
  else if (/\.gifv$/.test(post.url)) {
    res({
      src: [".webm", ".mp4"].map(x => https(post.url.replace(/\.\w+$/, x))),
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
    r.addEventListener("error", () => rej(post));
    r.addEventListener("abort", () => rej(post));
    r.addEventListener("load", function() {
      const sources = [];
      if (r.response && r.response.gfyItem && r.response.gfyItem.webmUrl)
        sources.push(https(r.response.gfyItem.webmUrl));
      if (r.response && r.response.gfyItem && r.response.gfyItem.mp4Url)
        sources.push(https(r.response.gfyItem.mp4Url));
      if (sources.length > 0)
        res({ src: sources, type: "video" });
      else
        rej(post);
    });
    r.send();
  }
  else
    rej(post);
});

const ContentExtractor = function(sub, pre=5, sorting="hot", period="") {
  this.subreddit = sub;
  this.preload = pre;
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
  if (that.barren)
    rej();
  else if (that.exhausted)
    res();
  else if (that.contents.length > (that.i===null?-1:that.i) + that.preload)
    res();
  else if (that.listing.length) {
    const post = that.listing.shift();
    extractContentSource(post)
    .then(source => {
      const content = {
        permalink: "https://www.reddit.com" + post.permalink,
        title: post.title,
        subreddit: that.subreddit,
        type: source.type,
        src: source.src
      };
      that.consecutiveEmptyListings = 0;
      that.contents.push(content);
      that.loadNextContent();
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

ContentExtractor.prototype.getNextContent =
function() { return (that => new Promise((res, rej) => {
  if (that.barren)
    rej();
  else if (that.exhausted) {
    that.i = that.i === null ? 0 : that.i + 1;
    that.i = that.i >= that.contents.length ? 0 : that.i;
    res(that.contents[that.i]);
  }
  else if (that.i === null && that.contents.length) {
    that.i = 0;
    res(that.contents[that.i]);
    that.loadNextContent();
  }
  else if (!that.contents.length || that.i >= that.contents.length - 1) {
    that.loadNextContent().then(() => that.getNextContent()).then(res, rej);
  }
  else {
    that.i += 1;
    res(that.contents[that.i]);
    that.loadNextContent();
  }
}))(this)};
