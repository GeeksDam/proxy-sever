const fs = require("fs");

// fwl file content should take the form
//{"deny": ["facebook.com", "youtube.com"]}

const readFirewallList = () => {
  const path = "./fwl.json";
  if (!fs.existsSync(path)) {
    fs.write("fwl.json", JSON.stringify({ deny: ["juga.com"] }));
  }
  const rawList = fs.readFileSync(path);
  return rawList && JSON.parse(rawList);
};

const addToFirewallBlockList = (url) => {
  const prevList = readFirewallList();
  if ([...prevList.deny].includes(url)) return;
  let newList = {
    deny: [...prevList.deny, url],
  };
  const data = JSON.stringify(newList);
  fs.writeFileSync("fwl.json", data);
};

const removeFromFirewallBlockList = (url) => {
  const prevList = readFirewallList();
  let newList = {
    deny: [...prevList.deny.filter((f) => f !== url)],
  };
  const data = JSON.stringify(newList);
  fs.writeFileSync("fwl.json", data);
};

const isDenyMatch = (url) => {
  const fwList = readFirewallList();
  return fwList && fwList.deny.length && fwList.deny.includes(url);
};

// this function extracts the original destination domain name from the string passed to it
const getDestinationUrl = (url) => {
  if (!url) return "";
  const getPosition = (string, subString, index) => {
    return string
      .split("")
      .reverse()
      .join("")
      .split(subString, index)
      .join(subString).length;
  };
  const pos = getPosition(url, ".", 2);
  return url.substring(url.length - pos, url.length);
};

module.exports = {
  addToFirewallBlockList,
  removeFromFirewallBlockList,
  readFirewallList,
  isDenyMatch,
  getDestinationUrl,
};
