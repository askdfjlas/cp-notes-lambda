module.exports.throwCustomError = function(errorObject) {
  let err = Error(errorObject.message);
  err.name = errorObject.name;
  err.clientError = true;
  throw err;
}

module.exports.getInverseTimestamp = function(timestamp) {
  const maxCharCode = 'Z'.charCodeAt(0);
  let result = '';
  for(let i = 0; i < timestamp.length; i++) {
    const inverseCharCode = maxCharCode - timestamp.charCodeAt(i);
    result += String.fromCharCode(inverseCharCode);
  }
  return result;
}
