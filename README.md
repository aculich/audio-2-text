# Introduction
Audio-2-Text is part of a serverless transcription pipeline built on Google Cloud Platform. The main element included in this pipeline is the Google Cloud Function code that is deployed to be triggered by a Google Cloud Storage object change notification trigger.

The pipeline is built on three components:
1. Google Cloud Storage
1. Google Cloud Functions
1. Google Cloud Speech API

The workflow is as follows:
1. Upload an audio file you want transcribed to the monitored Cloud Storage bucket
1. The upload of an object triggers an object change notification, which triggers a Cloud Function
1. The Cloud Function reads the uploaded file and makes an API call to the Cloud Speech API, referencing the audio file in the Cloud Storage bucket
1. Once finished processing, the Cloud Speech API returns a text file to the Cloud Function
1. The Cloud Function writes the text file to another bucket that isn't being monitored

## Caveat
Currently, the Cloud Function is hard-coded to only accept audio files with the following characteristics:
- Format: FLAC
- Frequency: 44,100 Hz
- Channels: Mono (this is a Cloud Speech API requirement)
- Language: English (US)

Also, be sure to assign the proper Cloud Storage bucket names to the `audioBucketName` & `textBucketName` variables.

## Deployment
In order to deploy the `index.js` file to a cloud function, you would first need to make sure that you have the Google Cloud SDK configured, and the Cloud Functions & Cloud Speech APIs enabled in your Google Cloud Platform API Explorer console.

There are four elements that need to be defined:
1. `FN_NAME`: The name of the function (within the `index.js` file) that will be deployed to be triggered.
1. `FN_BUCKET`: The name of the Cloud Storage bucket where you will 'stage' the code of the Cloud Function.
1. `TRIGGER_BUCKET`: The name of the Cloud Storage bucket that you want apply the trigger on so that whenever an object within this bucket is changed, the function is triggered.
1. You would need to create a destination bucket where the function can upload the transcribed txt file that it receives from the Cloud Speech API

Once you have these buckets created and set up, and you've edited the `index.js` file to contain the proper bucket names (`audioBucketName` & `textBucketName`), you are ready to deploy the audio-2-text Cloud Function. Issuing the following `gcloud` command will deploy the function to the staging bucket and will set the trigger on the bucket to be monitored:

`gcloud beta functions deploy ${FN_NAME} --stage-bucket ${FN_BUCKET} --trigger-bucket ${TRIGGER_BUCKET}`

Once that's done, all you need to do is upload an audio file to the monitored bucket, and follow the logs in your GCP console to see the status of the transcription. Once the Cloud Speech API service completes transcribing the file you should find a file in the text bucket with the same name as your original audio file, with a 'txt' extension instead.

Enjoy!
