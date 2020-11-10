module.exports.throwCustomError = function(name, message) {
  let err = Error(message);
  err.name = name;
  err.clientError = true;
  throw err;
}
