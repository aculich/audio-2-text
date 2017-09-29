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
const speech = require('@google-cloud/speech');
const storage = require('@google-cloud/storage');
const util = require('util');

exports.audio2text = function(event, callback) {

	const audioFile = event.data;

	// Check status of uploaded object
	if (audioFile.resourceState === 'not_exists') {
		console.log('File ' + audioFile.name + ' was deleted. Nothing to do.');
	} else {
		if (audioFile.metageneration === '1') {
			console.log('New file ' + audioFile.name + ' uploaded to storage bucket.');
		} else {
			console.log('File ' + audioFile.name + ' metadata updated.');
		};

		//const projectId = 'audio-2-text';
		// Set GCloud project ID
		const projectId = process.env.GCLOUD_PROJECT;

		// Instantiate Google Cloud services clients
		var speechApiClient = speech({
			projectId: projectId
		});

		var storageClient = storage({
			projectId: projectId
		});

		const projectName = process.env.GCP_PROJECT;
		const customerCode = 'customer-tohpiej7ee6aevee'
		const audioBucketName = projectName + '-' + customerCode + '-audio'
		const textBucketName = projectName + '-' + customerCode + '-text'

		var audioBucket = storageClient.bucket(audioBucketName);
		var textBucket = storageClient.bucket(textBucketName);

		// Create request configuration to be passed along the API call request
		const encoding = speech.v1.types.RecognitionConfig.AudioEncoding.FLAC;
		const sampleRateHertz = 44100;
		const languageCode = 'en-US';
		const config = {
			encoding : encoding,
			sampleRateHertz : sampleRateHertz,
			languageCode : languageCode
		};
		const uri = 'gs://' + audioBucketName + '/' + audioFile.name;
		const audio = {
			uri : uri
		};
		const request = {
			config: config,
			audio: audio
		};

		// Initiate API call to the Cloud Speech service
		speechApiClient.longRunningRecognize(request)
			.then(function(responses) {
				var operation = responses[0];
				var initialApiResponse = responses[1];

				// Adding a listener for the 'complete' event starts polling for the
				// completion of the operation.
				operation.on('complete', function(response, metadata, finalApiResponse) {

					//const transcription = response.results[0].alternatives[0].transcript;
					const transcription = response.results.map(result =>
						result.alternatives[0].transcript).join('\n');
					const fileName = rewrite(audioFile.name, '.txt');
					const tempFilePath = path.join(os.tmpdir(), fileName);

					// Write file temporarily to local filesystem
					fs.writeFile(tempFilePath, transcription, function(err) {
						console.error(err);
					});
					console.log('Transcription written temporarily to ' + tempFilePath);

					// Upload transcription to Cloud Storage
					textBucket.upload(tempFilePath, function(err) {
						console.error(err);
					});
					console.log('Transcription uploaded to storage bucket');
				});

				// Adding a listener for the 'progress' event causes the callback to be
				// called on any change in metadata when the operation is polled.
				operation.on('progress', function(metadata, apiResponse) {
					console.log(util.inspect(apiResponse, false, null));
					console.log('Transcription of "' + audioFile.name + '" still ongoing');
				});

				// Adding a listener for the 'error' event handles any errors found during
				// polling.
				operation.on('error', function(err) {
					console.error(err);
				});
		})
		.catch(function(err) {
			console.error(err);
		});
	};

	callback();
};
