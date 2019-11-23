/**
 * Request handlers
 *
 */

// Dependencies
const _data = require("./data");
const helpers = require("./helpers");
const config = require("./config");

// Define the handlers.
const handlers = {};

// Ping handler
handlers.ping = (data, callback) => {
  // Callback a HTTP status code and a payload object
  callback(200);
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

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

// Users - POST
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  let {
    payload: { firstName, lastName, phone, password, tosAgreement }
  } = data;

  // Check that all required data fields are field out
  firstName = typeof firstName === "string" && firstName.trim().length > 0 ? firstName.trim() : false;
  lastName = typeof lastName === "string" && lastName.trim().length > 0 ? lastName.trim() : false;
  phone = typeof phone === "string" && phone.trim().length === 10 ? phone.trim() : false;
  password = typeof password === "string" && password.trim().length > 0 ? password.trim() : false;
  tosAgreement = typeof tosAgreement === "boolean" && tosAgreement ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure that the user doesn't already exist
    _data.read("users", phone, (err, data) => {
      // If it returns an error that means the read operation did not find the user so we can proceed with creating a new one.
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

// Users - GET
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  let {
    queryStringObject: { phone },
    headers: { token }
  } = data;

  // Check that the phone number is valid
  phone = typeof phone === "string" && phone.trim().length === 10 ? phone.trim() : false;

  if (phone) {
    // Get the token from the headers
    token = typeof token === "string" ? token : false;
    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, tokenIsValid => {
      if (tokenIsValid) {
        // Lookup the user
        _data.read("users", phone, (err, userData) => {
          if (!err && userData) {
            // Remove the hashed password from the user object before returning it ti the requestor
            const { hashedPassword, ...cleanUserData } = userData;
            callback(200, cleanUserData);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header or token is invalid"
        });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Users - PUT
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data, callback) => {
  let {
    payload: { firstName, lastName, phone, password },
    headers: { token }
  } = data;

  // Check for the required filed
  phone = typeof phone === "string" && phone.trim().length === 10 ? phone.trim() : false;

  // Check for the optional fields
  firstName = typeof firstName === "string" && firstName.trim().length > 0 ? firstName.trim() : false;
  lastName = typeof lastName === "string" && lastName.trim().length > 0 ? lastName.trim() : false;
  password = typeof password === "string" && password.trim().length > 0 ? password.trim() : false;

  // Error if the phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {
      // Get the token from the headers
      token = typeof token === "string" ? token : false;

      // Verify that the given token is valid for the phone number
      handlers._tokens.verifyToken(token, phone, tokenIsValid => {
        if (tokenIsValid) {
          // Lookup the user
          _data.read("users", phone, (err, userData) => {
            if (!err && userData) {
              // Update the necessary fields
              const updatedUserData = {
                ...userData,
                firstName: firstName || userData.firstName,
                lastName: lastName || userData.lastName,
                password: password || userData.password
              };

              // Store the new updates
              _data.update("users", phone, updatedUserData, err => {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { Error: "Could not update the user" });
                }
              });
            } else {
              callback(400, { Error: "The specified user does not exist" });
            }
          });
        } else {
          callback(403, {
            Error: "Missing required token in header or token is invalid"
          });
        }
      });
    } else {
      callback(400, { Error: "Missing field(s) to update" });
    }
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Users - DELETE
// Required data: phone
// Cleanup old checks associated with the user
handlers._users.delete = (data, callback) => {
  let {
    queryStringObject: { phone },
    headers: { token }
  } = data;

  // Validate inputs
  phone = typeof phone === "string" && phone.trim().length === 10 ? phone.trim() : false;

  if (phone) {
    // Get token from headers
    token = typeof token === "string" ? token : false;

    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, tokenIsValid => {
      if (tokenIsValid) {
        // Lookup the user
        _data.read("users", phone, (err, userData) => {
          if (!err && userData) {
            // Delete the user's data
            _data.delete("users", phone, err => {
              if (!err) {
                // Delete each of the checks associated with the user
                const { checks: userChecks = [] } = userData;
                const checksToDelete = userChecks.length;

                if (checksToDelete > 0) {
                  let checksDeleted = 0;
                  const deletionErrors = false;

                  // Loop through the checks
                  userChecks.forEach(checkId => {
                    // Delete the check
                    _data.delete("checks", checkId, err => {
                      if (err) {
                        deletionErrors = true;
                      }

                      checksDeleted++;

                      if (checksDeleted === checksToDelete && !deletionErrors) {
                        callback(200);
                      } else {
                        callback(500, {
                          Error:
                            "Errors encountered while attempting to delete all of the user's checks. All checks may not have been deleted from the system successfully."
                        });
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(500, { Error: "Could not delete the specified user" });
              }
            });
          } else {
            callback(400, { Error: "Could not find the specified user." });
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header, or token is invalid."
        });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Tokens handler
handlers.tokens = (data, callback) => {
  const methods = ["post", "get", "put", "delete"];
  if (methods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all tokens methods
handlers._tokens = {};

// Tokens - POST
// Required data: phone, password
// Optional data: none
handlers._tokens.post = (data, callback) => {
  let {
    payload: { phone, password }
  } = data;

  // Validate inputs
  phone = typeof phone === "string" && phone.trim().length === 10 ? phone.trim() : false;
  password = typeof password === "string" && password.trim().length > 0 ? password.trim() : false;

  if (phone && password) {
    // Lookup the user who matches that phone number
    _data.read("users", phone, (err, userData) => {
      if (!err && userData) {
        // Hash the sent password and compare it to the stored in the userObject
        const hashedPassword = helpers.hash(password);

        if (hashedPassword === userData.hashedPassword) {
          // If valid, create a new token with a random name. Set expiration date 1 hour in the future
          const tokenId = helpers.createRandomString(20);

          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            phone,
            id: tokenId,
            expires
          };

          // Store the token
          _data.create("tokens", tokenId, tokenObject, err => {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { Error: "Could not create the new token" });
            }
          });
        } else {
          callback(400, {
            Error: "Password did not match the specified user's stored"
          });
        }
      } else {
        callback(400, { Error: "Could not find the specified user" });
      }
    });
  } else {
    callback(400, { Error: "Mising required field(s)" });
  }
};

// Tokens - GET
// Required data: id
// Optional data: none
handlers._tokens.get = (data, callback) => {
  let {
    queryStringObject: { id }
  } = data;

  // Validate inputs
  id = typeof id === "string" && id.trim().length === 20 ? id.trim() : false;

  if (id) {
    // Lookup the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Tokens - PUT
// Required data: id, extend
// Optional data: none
handlers._tokens.put = (data, callback) => {
  let {
    payload: { id, extend }
  } = data;

  // Validate inputs
  id = typeof id === "string" && id.trim().length === 20 ? id.trim() : false;
  extend = typeof extend === "boolean" && extend === true ? true : false;

  if (id && extend) {
    // Lookup the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        // Check if the token isn't already expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          const updatedToken = {
            ...tokenData,
            expires: Date.now() + 1000 * 60 * 60
          };

          // Store the new updates
          _data.update("tokens", id, updatedToken, err => {
            if (!err) {
              callback(200);
            } else {
              callback(500, {
                Error: "Could not update the token's expiration"
              });
            }
          });
        } else {
          callback(400, {
            Error: "The token has already expired and can not be extended"
          });
        }
      } else {
        callback(400, { Error: "Specified token does not exist" });
      }
    });
  } else {
    callback(400, {
      Error: "Missing required field(s) or field(s) are invalid"
    });
  }
};

// Tokens - DELETE
// Required data: id
// Optional data: id
handlers._tokens.delete = (data, callback) => {
  let {
    queryStringObject: { id }
  } = data;

  // Check that the token id is valid
  const id = typeof id === "string" && id.trim().length === 20 ? id.trim() : false;

  if (id) {
    // Lookup the user
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        _data.delete("tokens", id, err => {
          if (!err) {
            callback(200);
          } else {
            callback(500, { Error: "Could not find specified token" });
          }
        });
      } else {
        callback(400, { Error: "Could not find the specified token" });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

// Verify if a given id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback) => {
  // Lookup the token
  _data.read("tokens", id, (err, tokenData) => {
    if (!err && tokenData) {
      // Check that the the token is for the given user and has not expired
      if (tokenData.phone === phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// Checks
handlers.checks = (data, callback) => {
  const acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the checks handlers
handlers._checks = {};

// Checks - POST
// Required data: protocol, url, method ,successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = (data, callback) => {
  let {
    payload: { protocol, url, method, successCodes, timeoutSeconds: timeout },
    headers: { token }
  } = data;

  // Validate inputs
  protocol = typeof protocol == "string" && ["https", "http"].indexOf(protocol) > -1 ? protocol : false;
  url = typeof url == "string" && url.trim().length > 0 ? url.trim() : false;
  method = typeof method == "string" && ["post", "get", "put", "delete"].indexOf(method) > -1 ? method : false;
  successCodes = typeof successCodes == "object" && successCodes instanceof Array && successCodes.length > 0 ? successCodes : false;
  timeout = typeof timeout == "number" && timeout % 1 === 0 && timeout >= 1 && timeout <= 5 ? timeout : false;

  if (protocol && url && method && successCodes && timeout) {
    // Get token from headers
    token = typeof token == "string" ? token : false;

    // Lookup the user phone by reading the token
    _data.read("tokens", token, (err, tokenData) => {
      if (!err && tokenData) {
        const userPhone = tokenData.phone;

        // Lookup the user data
        _data.read("users", userPhone, (err, userData) => {
          if (!err && userData) {
            const { checks: userChecks = [] } = userData;

            // Verify that user has less than the number of max-checks per user
            if (userChecks.length < config.maxChecks) {
              // Create random id for check
              const checkId = helpers.createRandomString(20);

              // Create check object including userPhone
              const checkObject = {
                id: checkId,
                userPhone,
                protocol,
                url,
                method,
                successCodes,
                timeoutSeconds: timeout
              };

              // Save the object
              _data.create("checks", checkId, checkObject, err => {
                if (!err) {
                  // Add check id to the user's object
                  userChecks.push(checkId);
                  const updatedUserData = {
                    ...userData,
                    checks: userChecks
                  };

                  // Save the new user data
                  _data.update("users", userPhone, updatedUserData, err => {
                    if (!err) {
                      // Return the data about the new check
                      callback(200, checkObject);
                    } else {
                      callback(500, {
                        Error: "Could not update the user with the new check."
                      });
                    }
                  });
                } else {
                  callback(500, { Error: "Could not create the new check" });
                }
              });
            } else {
              callback(400, {
                Error: "The user already has the maximum number of checks (" + config.maxChecks + ")."
              });
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, { Error: "Missing required inputs, or inputs are invalid" });
  }
};

// Checks - GET
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
  let {
    queryStringObject: { id },
    headers: { token }
  } = data;

  // Check that id is valid
  id = typeof id == "string" && id.trim().length == 20 ? id.trim() : false;

  if (id) {
    // Lookup the check
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        // Get the token that sent the request
        token = typeof data.headers.token == "string" ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
          if (tokenIsValid) {
            // Return check data
            callback(200, checkData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: "Missing required field, or field invalid" });
  }
};

// Checks - PUT
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (at least one must be sent)
handlers._checks.put = (data, callback) => {
  let {
    payload: { id, protocol, url, method, successCodes, timeoutSeconds: timeout },
    headers: { token }
  } = data;

  // Check for required field
  id = typeof id == "string" && id.trim().length == 20 ? id.trim() : false;

  // Check for optional fields
  protocol = typeof protocol == "string" && ["https", "http"].indexOf(protocol) > -1 ? protocol : false;
  url = typeof url == "string" && url.trim().length > 0 ? url.trim() : false;
  method = typeof method == "string" && ["post", "get", "put", "delete"].indexOf(method) > -1 ? method : false;
  successCodes = typeof successCodes == "object" && successCodes instanceof Array && successCodes.length > 0 ? successCodes : false;
  timeout = typeof timeout == "number" && timeout % 1 === 0 && timeout >= 1 && timeout <= 5 ? timeout : false;

  // Error if id is invalid
  if (id) {
    // Error if nothing is sent to update
    if (protocol || url || method || successCodes || timeout) {
      // Lookup the check
      _data.read("checks", id, (err, checkData) => {
        if (!err && checkData) {
          // Get the token that sent the request
          token = typeof data.headers.token == "string" ? data.headers.token : false;

          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
            if (tokenIsValid) {
              // Update check data where necessary
              const updatedCheckData = {
                ...checkData,
                protocol: protocol || checkData.protocol,
                url: url || checkData.url,
                method: method || checkData.method,
                successCodes: successCodes || checkData.successCodes,
                timeoutSeconds: timeout || checkData.timeoutSeconds
              };

              // Store the new updates
              _data.update("checks", id, updatedCheckData, err => {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { Error: "Could not update the check." });
                }
              });
            } else {
              callback(403);
            }
          });
        } else {
          callback(400, { Error: "Check ID did not exist." });
        }
      });
    } else {
      callback(400, { Error: "Missing fields to update." });
    }
  } else {
    callback(400, { Error: "Missing required field." });
  }
};

// Checks - DELETE
// Required data: id
// Optional data: none
handlers._checks.delete = (data, callback) => {
  let {
    queryStringObject: { id },
    headers: { token }
  } = data;

  // Check that id is valid
  id = typeof id == "string" && id.trim().length == 20 ? id.trim() : false;

  if (id) {
    // Lookup the check
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        // Get the token that sent the request
        token = typeof token == "string" ? token : false;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
          if (tokenIsValid) {
            // Delete the check data
            _data.delete("checks", id, err => {
              if (!err) {
                // Lookup the user's object to get all their checks
                _data.read("users", checkData.userPhone, (err, userData) => {
                  if (!err) {
                    const { checks: userChecks = [] } = userData;

                    // Remove the deleted check from their list of checks
                    const checkPosition = userChecks.indexOf(id);

                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);

                      // Re-save the user's data
                      const updatedUserData = {
                        ...userData,
                        checks: userChecks
                      };

                      _data.update("users", checkData.userPhone, updatedUserData, err => {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, {
                            Error: "Could not update the user."
                          });
                        }
                      });
                    } else {
                      callback(500, {
                        Error: "Could not find the check on the user's object, so could not remove it."
                      });
                    }
                  } else {
                    callback(500, {
                      Error:
                        "Could not find the user who created the check, so could not remove the check from the list of checks on their user object."
                    });
                  }
                });
              } else {
                callback(500, { Error: "Could not delete the check data." });
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400, { Error: "The check ID specified could not be found" });
      }
    });
  } else {
    callback(400, { Error: "Missing valid id" });
  }
};

// Export handlers
module.exports = handlers;
