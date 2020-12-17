module.exports.throwCustomError = function(errorObject) {
  let err = Error(errorObject.message);
  err.name = errorObject.name;
  err.clientError = true;
  throw err;
}
