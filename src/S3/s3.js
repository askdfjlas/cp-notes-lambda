const aws = require('aws-sdk');
const s3 = new aws.S3({ region: 'us-east-1', apiVersion: '2006-03-01' });

async function writeFile(bucketName, fileName, data, encoding, contentType) {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: data,
    ContentEncoding: encoding,
    ContentType: contentType
  };

  await s3.putObject(params).promise();
}

async function getFile(bucketName, fileName, image) {
  const params = {
    Bucket: bucketName,
    Key: fileName
  };

  const data = await s3.getObject(params).promise();

  if(image) return data.Body.toString('base64');
  return data.Body.toString();
}

module.exports.writeFile = writeFile;
module.exports.getFile = getFile;
