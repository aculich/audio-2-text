/**
 * Audio-2-Text is a background Cloud Function that is triggered by an object
 * change notification event from a Cloud Storage bucket.
 *
 * @param {object} event The Cloud Functions event.
 * @param {function} callback The callback function.
 */

const rewrite = require('rewrite-ext');
const Speech = require('@google-cloud/speech');
const Storage = require('@google-cloud/storage');
const RuntimeConfigurator = require('@google-cloud/rcloadenv');

exports.audio2text = (event, callback) => {

  // Assign event data to local object 'file'
  const file = event.data;

  // Assess the type of object change notification received that triggered the
  // function's execution
  if (file.metageneration === '1') {
    console.log('INFO: New file uploaded');
    console.log('INFO: File name: ' + file.name);
  } else {
    console.log('INFO: Existing file changed');
    console.log('INFO: File name: ' + file.name);
  }

  // Read environment variables from Runtime Configurator
  RuntimeConfigurator
    .getAndApply('audio2text-env-vars')
    .then(() => {
      // Set local objects to env variable values
      const audioBucketName = process.env.AUDIO_BUCKET;
      const textBucketName = process.env.TEXT_BUCKET;
      const projectId = process.env.GCLOUD_PROJECT;

      // Create Google Cloud Storage handler object
      const storage = new Storage({
        projectId: projectId,
      });

      // Create Google Cloud Speech API client handler object
      const speech = new Speech.SpeechClient({
        projectId: projectId,
      });

      // Define audio file specifications
      //
      // Audio file specification is currently set statically as:
      // Language: English
      // Channels: Mono
      // Codec: FLAC
      // Sample rate: 44.1 kHz
      //
      // Future version of this code should be able to detect audio file format,
      // or receive it from an external source
      const encoding = 'FLAC';
      const sampleRateHertz = 44100;
      const languageCode = 'en-US';

      // Set Google Cloud Storage URI for audio file object to be written
      const uri = 'gs://' + audioBucketName + '/' + file.name;

      // Create Speech API config object for audio file
      const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode
      };

      // Set audio file URI for Speech API
      const audio = {
        uri: uri,
      };

      // Create Speech API request object
      const request = {
        config: config,
        audio: audio
      };

      // Execute Speech API call
      speech.longRunningRecognize(request)
        .then((responses) => {
          // Operation promise starts polling for the completion of the Long
          // Running Operation (LRO).
          return responses[0].promise();
        })
        .then((responses) => {

          // Join first result from received responses array, using '\n' as a
          // delimiter for each array entry.
          const transcription = responses[0].results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

          // Construct temp text file name by adding '.txt' extension
          const fileName = rewrite(file.name, '.txt');

          storage
            .bucket(textBucketName)
            .file(fileName)
            .save(transcription)
            .then(() => {
              console.log(
                'INFO: Transcribed text uploaded to gs://' + textBucketName + '/' + fileName
              );
            });
        })
        .catch((err) => {
          // Send error callback
          console.error('ERROR: ', err);
          callback(err);
        });

      // Send success callback
      callback();
    })
    .catch((err) => {
      // Send error callback
      callback(err);
    });
};
