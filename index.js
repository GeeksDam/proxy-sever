const net = require("net");
const express = require("express");
const moment = require("moment");
const mongoose = require("mongoose");
const { StringDecoder } = require("string_decoder");
const decoder = new StringDecoder("utf8");
const {
  addToFirewallBlockList,
  removeFromFirewallBlockList,
  readFirewallList,
  isDenyMatch,
  getDestinationUrl,
} = require("./utils");
const Model = require("./model");

const server = net.createServer();
const app = express();

// MonogoDB setup & interaction
const mongoString =
  "mongodb+srv://damo:YZ2r8oDiXT3erZiy@cluster0.lmttx.mongodb.net/?retryWrites=true&w=majority&ssl=true";

mongoose.connect(mongoString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const database = mongoose.connection;
database.on("error", (error) => {
  console.log(error);
});

database.once("connected", () => {
  console.log("Database Connected");
});

let logState = [];

const addToLogState = (item) => {
  if (logState.length > 5000) {
    logState = [];
  }
  logState.push(item);
};

// const options = {
//   key: fs.readFileSync("key.pem"),
//   cert: fs.readFileSync("cert.pem"),
// };

// we will be making use of the duplex stream of nodejs
// to connect to, and read data received from destination server from this proxy
// and write it back to the client requesting the data via the established socket
// connection via TCP and TLS
server.on("connection", (clientProxyPlug) => {
  // the connection here is an event listener
  console.log("Client proxy connection is successful.");

  clientProxyPlug.once("data", (data) => {
    // console.log(data.toString('ascii'));
    // console.log(decoder.write(Buffer.from(data)));

    // verify if connection is HTTPS or HTTP
    const isHttpsConnection = data.toString().indexOf("CONNECT") !== -1;
    let serverPort = 80;
    let serverAddress;

    //if HTTPS connection
    if (isHttpsConnection) {
      serverPort = 443;

      //get the address information from the client's request
      serverAddress = data
        .toString()
        .split("CONNECT")[1]
        .split(" ")[1]
        .split(":")[0];
    } else {
      // connection is HTTP, so get the address only
      // serverAddress = data.toString().split("Host: ")[1].split("\n")[0];
      // return error
      console.log("HTTP connection IS NOT allowed.");
    }
    // https://nodesource.com/blog/understanding-streams-in-nodejs/
    const serverAddressDomain = getDestinationUrl(serverAddress);

    // FIREWALL ACTION HERE:
    // Here we filter the traffic by checking it again the firewall deny list. If there is match, then the traffic is denied.
    if (isDenyMatch(serverAddressDomain)) {
      return console.log(`${serverAddressDomain} is blocked by firewall.`);
    }

    if (!isDenyMatch(serverAddressDomain)) {
      // log data
      const logData = new Model({
        clientIp: clientProxyPlug.remoteAddress,
        clientPort: clientProxyPlug.remotePort,
        destinationtAddress: serverAddressDomain,
        requestTime: new Date(),
      });
      addToLogState(logData);
      logData.save();

      // initiate proxy to server (destination) connection
      let proxyServerPlug = net.createConnection(
        {
          host: serverAddress,
          port: serverPort,
        },
        () => console.log("Proxy to server connection has been established.")
      );

      if (isHttpsConnection) clientProxyPlug.write("HTTP/1.1 200 OK\r\n\n");
      else proxyServerPlug.write(data);

      // write or pass destination response back to cilent and vice-versa
      clientProxyPlug.pipe(proxyServerPlug); // talk one way from client to server
      proxyServerPlug.pipe(clientProxyPlug); // response another way back to client

      clientProxyPlug.on("error", (err) =>
        console.log("Error in client-proxy connection. Reason: ", err)
      );

      proxyServerPlug.on("error", (err) =>
        console.log("Error in proxy-server connection. Reason: ", err)
      );

      // show encrypted client requests
      clientProxyPlug.on("data", (dd) => {
        const dataR = dd.toString();
        console.log("RESPONSE-TO-CLIENT: ", dataR);
      });

      // show encrypted server responses
      proxyServerPlug.on("data", (dd) => {
        const dataR = dd.toString();
        console.log("SERVER-RESPONSE: ", dataR);
      });
    }
  });
});

server.on("error", (error) => {
  console.log(`An error occured. Detail: ${error}`);
});

server.on("close", () => {
  console.log("Client disconnected.");
});

server.listen(
  {
    host: "0.0.0.0",
    port: 8081,
  },
  () => console.log("Server is up and running on PORT 8081.")
);

// set the view engine to ejs
app.set("view engine", "ejs");

// use res.render to load up an ejs view file

// index page
app.get("/", function (req, res) {
  res.render("pages/index", { list: readFirewallList().deny });
});

app.get("/log", function (req, res) {
  res.render("pages/log", {
    logs: logState.map((item) => ({
      clientIp: item.clientIp,
      clientPort: item.clientPort,
      destinationtAddress: item.destinationtAddress,
      requestTime: moment(item.requestTime).format("DD-MMM-YYYY HH:mm:ss"),
    })),
  });
});

app.get("/fw/add/:url", (req, res) => {
  const url = req.params.url;
  addToFirewallBlockList(url);
  res.send(
    `${url} was suuceessfully added to Firewall blocked list. \n Current List: \n ${
      readFirewallList().deny
    }`
  );
});

app.get("/fw/remove/:url", (req, res) => {
  const url = req.params.url;
  removeFromFirewallBlockList(url);
  res.send(
    `${url} was suuceessfully removed from Firewall blocked list. \n Current List: \n ${
      readFirewallList().deny
    }`
  );
});

app.get("/fw", (req, res) => {
  res.send(readFirewallList().deny);
});

app.get("/rawlog", (req, res) => {
  res.send(logState);
});

app.listen(4000, () => console.log("Web App is running on port 4000"));
