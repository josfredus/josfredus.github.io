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

const ContentExtractor = function(subreddit, sorting="hot", period="") {
  this.subreddit = subreddit;
  this.sorting = sorting;
  this.period = period;
  this.contentList = [];
  this.listing = [];
  this.after = "";
  this.exhausted = false;
  this.lastContentIndex = 0;
  this.barren = false;
  this.consecutiveEmptyListings = 0;
};

ContentExtractor.prototype.getNextContent =
function() { return (that => new Promise(function(res, rej) {
  const subIsExhausted = function() {
    that.exhausted = true;
    if (that.contentList.length)
      res(that.contentList[0]);
    else {
      that.barren = true;
      rej();
    }
  };
  if (that.barren)
    rej();
  else if (that.exhausted) {
    that.lastContentIndex = that.lastContentIndex + 1;
    if (that.lastContentIndex === that.contentList.length)
      that.lastContentIndex = 0;
    res(that.contentList[that.lastContentIndex]);
  }
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
      that.contentList.push(content);
      res(content);
    })
    .catch(() => {
      that.getNextContent().then(res, rej);
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
        that.getNextContent().then(res, rej);
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
