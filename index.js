/**
 * Primary file for the API
 *
 */

// Dependencies
const http = require("http");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;
const config = require('./config');

// The server should respond to all requests with a string
var server = http.createServer((req, res) => {
  // Get the URL and parse it
  const parsedUrl = url.parse(req.url, true);

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, "");

  // Get the query string as an object
  const queryStringObject = parsedUrl.query;

  // Get the HTTP method
  const method = req.method.toUpperCase();

  // Get the headers as an object
  const headers = req.headers;

  // Get the payload, if any
  const decoder = new StringDecoder("utf-8");
  let buffer = "";
  req.on("data", data => {
    buffer += decoder.write(data);
  });
  req.on("end", () => {
    buffer += decoder.end();

    // Choose the handler this request should go to. If one is not found use the Not found handler.
    const chosenHandler =
      typeof router[trimmedPath] !== "undefined"
        ? router[trimmedPath]
        : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: buffer
    };

    // Route the request to the hand=ler specified in the router
    chosenHandler(data, (statusCode, payload) => {
      // Use the status code called by the handler, or default to 200
      const resolvedStatusCode =
        typeof statusCode === "number" ? statusCode : 200;

      // Use the payload called by the handler, or default to empty object
      const resolvedPayload = typeof payload === "object" ? payload : {};

      // Convert the payload toa string
      const payloadString = JSON.stringify(resolvedPayload);

      // Return the response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resolvedStatusCode);
      res.end(payloadString);
      console.log(
        "Returning this response: ",
        resolvedStatusCode,
        payloadString
      );
    });
  });
});

// Start the server, and have it listen on port 3000
server.listen(config.port, () => {
  console.log(`The server is listening on port ${config.port} in ${config.envName} mode`);
});

// Define the handlers.
const handlers = {};

// Sample handler
handlers.sample = (data, callback) => {
  // Callback a HTTP status code and a payload object
  callback(406, { name: "sample handler" });
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

// Define a request router
const router = {
  sample: handlers.sample
};
