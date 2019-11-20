/**
 * Request handlers
 *
 */

// Dependencies
const _data = require("./data");
const helpers = require("./helpers");

// Define the handlers.
const handlers = {};

// Users handler
handlers.users = (data, callback) => {
  const methods = ["post", "get", "put", "delete"];
  if (methods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users sub-methods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  // Check that all required data fields are field out
  const firstName =
    typeof data.payload.firstName === "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  const phone =
    typeof data.payload.phone === "string" &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;
  const password =
    typeof data.payload.password === "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;
  const tosAgreement =
    typeof data.payload.tosAgreement === "boolean" && data.payload.tosAgreement
      ? true
      : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure that the user doesn't already exist
    _data.read("users", phone, (err, data) => {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          // Create the user object
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement
          };

          // Store the user
          _data.create("users", phone, userObject, err => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: "Could not create the new user" });
            }
          });
        } else {
          callback(500, { Error: "Could not hash the password" });
        }
      } else {
        // User already exists
        callback(400, {
          Error: "A user with that phone number already exists"
        });
      }
    });
  } else {
    callback(400, { Error: "Missing required fields" });
  }
};

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone === "string" &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;

  if (phone) {
    // Lookup the user
    _data.read("users", phone, (err, data) => {
      if (!err && data) {
        // Remove the hashed password from the user object before returning it ti the requestor
        delete data.hashedPassword;
        callback(200, data);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data, callback) => {
  // Check for the required filed
  const phone =
    typeof data.payload.phone === "string" &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;

  // Check for the optional fields
  const firstName =
    typeof data.payload.firstName === "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  const password =
    typeof data.payload.password === "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  // Error if the phone is invalid
  if (phone) {
    // Error is nothing is sent to update
    if (firstName || lastName || password) {
      // Lookup the user
      _data.read("users", phone, (err, userData) => {
        if (!err && userData) {
          // Update the fields necessary
          const updatedUserObject = { ...userData };
          if (firstName) {
            updatedUserObject.firstName = firstName;
          }
          if (lastName) {
            updatedUserObject.lastName = lastName;
          }
          if (password) {
            updatedUserObject.hashedPassword = helpers.hash(password);
          }

          // Store the new updates
          _data.update("users", phone, updatedUserObject, err => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: "Could not update the user" });
            }
          });
        } else {
          callback(400, { Error: "The specified user does not exist" });
        }
      });
    } else {
      callback(400, { Error: "Missing fields to update" });
    }
  } else {
    callback(400, { Error: "Missing required field", phone: phone });
  }
};

// Users - delete
handlers._users.delete = (data, callback) => {};

// Ping handler
handlers.ping = (data, callback) => {
  // Callback a HTTP status code and a payload object
  callback(200);
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

// Export handlers
module.exports = handlers;
