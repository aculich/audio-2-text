/**
 * Audio-2-Text is a background Cloud Function that is triggered by an object
 * change notification event from a Cloud Storage bucket.
 *
 * @param {object} event The Cloud Functions event.
 * @param {function} callback The callback function.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const rewrite = require('rewrite-ext');
const Speech = require('@google-cloud/speech');
const Storage = require('@google-cloud/storage');
const RuntimeConfigurator = require('@google-cloud/rcloadenv');
// const util = require('util');

exports.audio2text = function(event, callback) {

  const file = event.data;

  // Check status of uploaded object
  if (file.resourceState === 'not_exists') {
    console.log('File was deleted from audio storage bucket');
    console.log('File name: ' + file.name);
    console.log('Nothing to do');
    console.log('Function execution ending');
    callback();
    return;
  }

  if (file.metageneration === '1') {
    console.log('New file uploaded to audio storage bucket');
    console.log('File name: ' + file.name);
  } else {
    console.log('Existing file metadata updated in audio storage bucket');
    console.log('File name: ' + file.name);
  }

  console.log('Beginning transcription process');

  // Read environment variables from Runtime Configurator
  RuntimeConfigurator.getAndApply('audio2text-env-vars')
    .then(() => {
      // Set local variables based on env variables
      console.log('Reading environment variables from Runtime Configurator');
      const audioBucketName = process.env.AUDIO_BUCKET_NAME;
      const textBucketName = process.env.TEXT_BUCKET_NAME;
      const projectId = process.env.GCLOUD_PROJECT;
      console.log('AUDIO_BUCKET_NAME: ' + audioBucketName);
      console.log('TEXT_BUCKET_NAME: ' + textBucketName);
      console.log('GCLOUD_PROJECT: ' + projectId);

      // Instantiate Google Cloud services clients
      var speech = Speech({
        projectId: projectId,
      });

      var storage = Storage({
        projectId: projectId,
      });

      // var audioBucket = storage.bucket(audioBucketName);
      var textBucket = storage.bucket(textBucketName);

      // Create request configuration to be passed along the API call request
      const encoding = Speech.v1.types.RecognitionConfig.AudioEncoding.FLAC;
      const sampleRateHertz = 44100;
      const languageCode = 'en-US';
      const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
      };
      const uri = 'gs://' + audioBucketName + '/' + file.name;
      const audio = {
        uri: uri,
      };
      const request = {
        config: config,
        audio: audio,
      };

      // Initiate API call to the Cloud Speech service
      speech.longRunningRecognize(request)
        .then((responses) => {
          // Operation promise starts polling for the completion of the LRO.
          return responses[0].promise();
        })
        .then((responses) => {
          // The final result of the operation (responses[0]).
          const transcription = responses[0].results.map(result =>
            result.alternatives[0].transcript).join('\n');
          const fileName = rewrite(file.name, '.txt');
          const tempFilePath = path.join(os.tmpdir(), fileName);

          // Write file temporarily to local filesystem
          fs.writeFile(tempFilePath, transcription, (err) => {
            if (err) { throw new Error(err); }
          });
          console.log('Transcription written temporarily to ' + tempFilePath);

          // Upload transcription to Cloud Storage
          textBucket.upload(tempFilePath, (err) => {
            if (err) { throw new Error(err); }
          });
          console.log('Transcription uploaded to storage bucket');
        })
        .catch((err) => {
          callback(err);
        });
    })
    .catch((err) => {
      callback(err);
    });

  callback();
};
