let PerfHerderTimings = {
  1: 86400, // last day
  2: 172800, // last 2 days
  7: 604800, // last week
  14: 1209600, // last two weeks
  30: 2592000, // last month
  60: 5184000, // last two months
  90: 7776000, // last three months
  365: 31536000, // last year
};
function buildTreeHerderURL({ interval, signature }) {
  return "https://treeherder.mozilla.org/api/project/mozilla-central/performance/data/?" + (
    new URLSearchParams({
      format: "json",
      framework: "1", 
      interval,
      signatures: signature,
    })
  );
}
async function getPushIdRevision(push_id, callback) {
  let url = "https://treeherder.mozilla.org/api/project/mozilla-central/resultset/" + push_id + "/";
  let { revision } = await fetchJSON(url);
  return revision;
}
let pushInfo = {
  "33362": {
    type: "platform",
    bug: "1433837",
  }
};
async function getTooltip({ push_id: to_push_id }, { push_id: from_push_id }) {
  let info = pushInfo[to_push_id];
  if (info) {
    return `<br />${info.type} - <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=${info.bug}">Bug ${info.bug}</a>`;
  }
  return "";
}
async function getLink({ push_id: to_push_id }, { push_id: from_push_id }) {
  let from_revision = await getPushIdRevision(from_push_id);
  let to_revision = await getPushIdRevision(to_push_id);
  let url = "https://hg.mozilla.org/mozilla-central/pushloghtml?fromchange=" + from_revision + "&tochange=" + to_revision;
  return url;
}
async function fetchObsoleteTests(old_signatures, interval, data) {
  let oldestTime = new Date().getTime() - ( interval * 1000 );
  for (let { id, signature, before } of old_signatures) {
    console.log("old signature", signature, "id", id, before > oldestTime);
    if (before > oldestTime) {
      let url = buildTreeHerderURL({ interval, signature });
      let response = await fetchJSON(url);
      if (response && response[signature]) {
        data.push(...response[signature]);
      }
    }
  }
}
async function loadPerfHerderData({ interval, platform, test }) {
  let signatures = PerfHerderSignatures[test]
  if (!signatures) {
    throw new Error("Unable to find any DAMP test named '" + test + "'");
  }
  let signature = signatures.platforms[platform].signature;
  if (!signature) {
    throw new Error("Unable to find test '" + test + "' for platform '" + platform + "'");
  }
  let perfHerderId = signatures.platforms[platform].id;
  console.log("signature", signature, "id", perfHerderId);
  let url = buildTreeHerderURL({ interval, signature });

  let data = [];

  let { old_signatures } = signatures.platforms[platform];
  await fetchObsoleteTests(old_signatures, interval, data);

  let response = await fetchJSON(url);
  data.push(...response[signature]);

  data.sort((d1, d2) => d1.push_timestamp > d2.push_timestamp);

  let i = 0;
  for (let d of data) {
    d.date = new Date(d.push_timestamp * 1000);
    d.getTooltip = getTooltip.bind(null, d, data[i - 1]);
    d.getLink = getLink.bind(null, d, data[i - 1]);
    let info = pushInfo[d.push_id];
    if (info) {
      let isRegression = d.value > data[i-1].value;
      switch(info.type) {
        case "platform":
          d.fill = isRegression ? "orange" : "lightgreen";
          break;
        case "devtools":
          d.fill = isRegression ? "red" : "green";
          break;
        case "damp":
          d.fill = isRegression ? "gray" : "lightgray";
          break;
       }
    }
    i++;
  }

  console.log("perfherder data", data);
/*
  let settleData = null;
  if (PerfHerderSignatures[test + ".settle"]) {
    signatures = PerfHerderSignatures[test + ".settle"]
    signature = signatures.platforms[platform].signature;
    perfHerderId = signatures.platforms[platform].id;
    console.log("signature settle", signature, "id", perfHerderId);
    url = buildTreeHerderURL({ interval, signature });
    response = await fetchJSON(url);
    settleData = response[signature];
    console.log("settle perfherder data", settleData);

    settleData.forEach((d, i) => {
      d.date = new Date(d.push_timestamp * 1000);
      d.getTooltip = getTooltip.bind(null, d, data[i - 1]);
      d.getLink = getLink.bind(null, d, data[i - 1]);
    });
  }
  */

  // document.getElementById("loading").style.display = "none";
  // let g = graph(data, {
  //   displayAverageLine: true,
  //   //cummulativeData: settleData,
  // });

  // // Display a link to PerfHerder
  // let perfHerderLink = "https://treeherder.mozilla.org/perf.html#/graphs?timerange=" + interval + "&series=mozilla-central," + perfHerderId+ ",1,1";
  // g.append("a")
  //  .attr("xlink:href", perfHerderLink)
  //  .attr("target", "_blank")
  //  .append("text")
  //  .attr("x", 10)
  //  .attr("y", 10)
  //  .text("PerfHerder");
}

function renderPerfHerderData(data) {
  let g = graph(data, {
    displayAverageLine: true,
    //cummulativeData: settleData,
  });

  // Display a link to PerfHerder
  let perfHerderLink = "https://treeherder.mozilla.org/perf.html#/graphs?timerange=" + interval + "&series=mozilla-central," + perfHerderId+ ",1,1";
  g.append("a")
   .attr("xlink:href", perfHerderLink)
   .attr("target", "_blank")
   .append("text")
   .attr("x", 10)
   .attr("y", 10)
   .text("PerfHerder");
}

// function update() {
//   let params = new URL(window.location).searchParams;
//   if (!params.get("test")) {
//     return;
//   }
//   let interval = PerfHerderTimings[params.get("days") || 14];
//   let platform = params.get("platform") || "windows7-32-opt";
//   loadPerfHerderData({
//     interval,
//     platform,
//     test: params.get("test"),
//   });
// }

// window.addEventListener("load", update);
// window.addEventListener("resize", update);
// window.addEventListener("popstate", update);
