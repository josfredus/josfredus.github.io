const makeBtnToggle = function(btnElm) {
  let on = true;
  let onToggle = () => null;
  let onPutOn = () => null;
  let onPutOff = () => null;
  const putOn = function() {
    on = true;
    btnElm.className = "onbtn";
    onPutOn();
    onToggle();
  };
  const putOff = function() {
    on = false;
    btnElm.className = "offbtn";
    onPutOff();
    onToggle();
  };
  (btnElm.className === "offbtn" ? putOff : putOn)();
  btnElm.addEventListener("click", () => (on ? putOff : putOn)());
  return {
    isOn: () => on,
    putOn: putOn,
    putOff: putOff,
    setOnToggle: f => onToggle = f,
    setOnPutOn: f => onPutOn = f,
    setOnPutOff: f => onPutOff = f
  };
};

const createBtnRow = function(sets, def=0) {
  let val = sets[def][0];
  let onValueChange = oldVal => null;
  const btns = sets.map(function(set) {
    const elm = document.createElement("button");
    elm.innerHTML = set[1];
    elm.className = "offbtn";
    const tgl = makeBtnToggle(elm);
    tgl.setOnPutOn(function() {
      btns.forEach(function(btn) {
        if (btn.tgl === tgl) {
          const oldVal = val;
          val = btn.val;
          if (oldVal !== val) onValueChange(oldVal);
        }
        else
          btn.tgl.putOff();
      });
    });
    tgl.setOnPutOff(function() {
      let alone = true;
      for (let i = 0; i < btns.length; i++)
        if (btns[i].tgl.isOn())
          alone = false;
      if (alone)
        tgl.putOn();
    });
    return { elm: elm, tgl: tgl, val: set[0] };
  });
  btns[def].tgl.putOn();
  return {
    appendTo: function(prt) {
      btns.forEach(btn => prt.appendChild(btn.elm));
    },
    removeFrom: function(prt) {
      btns.forEach(btn => prt.removeChild(btn.elm));
    },
    getValue: () => val,
    setOnValueChange: f => onValueChange = f
  };
};

const setUpTheShow = timepiece => new Promise(function(res, rej) {
  const sortingRow = createBtnRow([
    ["hot", "Hot"],
    ["new", "New"],
    ["controversial", "Controversial"],
    ["top", "Top"],
    ["rising", "Rising"]
  ], 0);
  sortingRow.appendTo(document.getElementById("sorting"));
  const periodRow = createBtnRow([
    ["hour", "Now"],
    ["day", "Today"],
    ["week", "This Week"],
    ["month", "This Month"],
    ["year", "This Year"],
    ["all", "All Time"]
  ], 1);
  const periodDiv = document.getElementById("period");
  periodRow.appendTo(periodDiv);
  const settingsDiv = document.getElementById("settings");
  settingsDiv.removeChild(periodDiv);
  const afterPeriod = document.getElementById("afterPeriod");
  const periodIsRelevant = s => s === "top" || s === "controversial";
  sortingRow.setOnValueChange(function(oldVal) {
    const newVal = sortingRow.getValue();
    if (periodIsRelevant(oldVal) && !periodIsRelevant(newVal))
      settingsDiv.removeChild(periodDiv);
    else if (periodIsRelevant(newVal) && !periodIsRelevant(oldVal))
      settingsDiv.insertBefore(periodDiv, afterPeriod);
  });
  const shuffleTgl = makeBtnToggle(document.getElementById("shuffle"));
  const loopRow = createBtnRow([
    ["noloop", "Don't loop videos"],
    ["underloop", "Loop no longer than images"],
    ["cutloop", "Loop and cut, as long as images"],
    ["overloop", "Loop once more, longer than images"]
  ], 1);
  loopRow.appendTo(document.getElementById("loop"));
  const reverseTgl = makeBtnToggle(document.getElementById("reverse"));
  const rvsStartInp = document.getElementById("reverseStart");
  const rvsLoopBtn = document.getElementById("reverseLoop");
  const rvsLoopTgl = makeBtnToggle(rvsLoopBtn);
  const rvsP = document.getElementById("reverseDetails");
  reverseTgl.setOnPutOn(
    () => settingsDiv.insertBefore(rvsP, document.getElementById("start")));
  reverseTgl.setOnPutOff(() => settingsDiv.removeChild(rvsP));
  settingsDiv.removeChild(rvsP);
  let processing = false;
  const letsGetItOn = function() {
    if (processing) return;
    processing = true;
    document.getElementById("start").disabled = true;
    let valid = true;
    let errorLog = "";
    const addError = function(log) {
      errorLog += (errorLog.length ? "\n" : "") + log;
      valid = false;
    };
    const duration = parseFloat(document.getElementById("duration").value);
    if (isNaN(duration))
      addError("Input a <em>number</em> for the time skip.");
    else if (duration < 1)
      addError("Time skip must be <em>at least</em> 1 second long.");
    let rvrsStrt = parseFloat(rvsStartInp.value);
    if (reverseTgl.isOn()) {
      if (isNaN(rvrsStrt) || rvrsStrt !== Math.floor(rvrsStrt))
        addError("Input an <em>integer</em> for the starting place.");
      else if (rvrsStrt < 1 || rvrsStrt > 100)
        addError("Input a number <em>greater than</em> 1" +
          " and <em>lesser than</em> 100 for the starting place.");
      else
        rvrsStrt = Math.round(rvrsStrt);
    }
    const subs = document.getElementById("subs").value;
    const xtrs = [];
    if (!/^\s*\w+(\s+\w+)*\s*$/.test(subs))
      addError("Input a list of subreddit names separated by white space.");
    else if (valid) {
      const sorting = sortingRow.getValue();
      const period = periodIsRelevant(sorting) ? periodRow.getValue() : "";
      subs.split(/\s+/).forEach(function(part) {
        if (part !== "")
          xtrs.push(new ContentExtractor(part, sorting, period))
      });
      const animID = timepiece.animateLoading();
      Promise.all(xtrs.map(xtr => xtr.loadNextContent())).then(() => {
        let i = 0;
        while (i < xtrs.length) {
          if (xtrs[i].barren)
            xtrs.splice(i, 1);
          else
            i++;
        }
        if (xtrs.length) {
          timepiece.stopLoadingAnimation(animID);
          res({
            xtrs: xtrs,
            actDuration: duration * 1000,
            shuffle: shuffleTgl.isOn(),
            loop: loopRow.getValue(),
            reverse: reverseTgl.isOn(),
            reverseStart: rvrsStrt,
            reverseLoop: rvsLoopTgl.isOn()
          });
        }
        else {
          timepiece.stopLoadingAnimation(animID);
          document.getElementById("start").disabled = false;
          processing = false;
          document.getElementById("errorLog").textContent = "It looks " +
            "like the subreddits you requested are all barren of " +
            "pictures and videos. We cannot run the show!";
        }
      });
    }
    if (!valid) {
      document.getElementById("errorLog").innerHTML = errorLog;
      document.getElementById("start").disabled = false;
      processing = false;
    }
  };
  document.getElementById("start").addEventListener("click", letsGetItOn);
  const okBoomer = evt => { if(evt.key === "Enter") evt.preventDefault(); };
  document.getElementById("shuffle").addEventListener("keydown", okBoomer);
  document.getElementById("reverse").addEventListener("keydown", okBoomer);
  rvsLoopBtn.addEventListener("keydown", okBoomer);
  window.addEventListener("keyup", function(evt) {
    if (evt.key === "Enter")
      letsGetItOn();
  });
});
