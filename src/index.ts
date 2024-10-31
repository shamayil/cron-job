import AWS from 'aws-sdk';
import {Squiss} from 'squiss-ts';
import {Print} from 'ts-print';
import {IOptions, ProcessEnv} from './index.ds';
import {ISquissOptions} from 'squiss-ts/dist/Types';
import {ConfigurationOptions} from 'aws-sdk/lib/config-base';
import {ConfigurationServicePlaceholders} from 'aws-sdk/lib/config_service_placeholders';
import {APIVersions} from 'aws-sdk/lib/config';
import axios, {AxiosError, AxiosResponse} from 'axios';

const {
  AWS_ENDPOINT = '',
  AWS_ACCESS_KEY_ID = '',
  AWS_SECRET_ACCESS_KEY = '',
  SQUISS_BODY_FORMAT = 'json',
  QUEUE_REGION = '',
  MAX_IN_FLIGHT = '100',
  BATCH_SIZE = '10',
  POOL_INTERVAL_MS = '0',
  DEBUG_SQUISS = '',
  API_URL = ''
}: ProcessEnv = process.env;

const awsConfig: ConfigurationOptions & ConfigurationServicePlaceholders & APIVersions & { [key: string]: any } = {
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: QUEUE_REGION,
};

if (AWS_ENDPOINT !== '') {
  awsConfig.endpoint = new AWS.Endpoint(AWS_ENDPOINT);
  AWS.config.update(awsConfig);
}

const SquissOptions: ISquissOptions = {
  awsConfig,
  queueName: process.env.QUEUE_NAME,
  maxInFlight: +MAX_IN_FLIGHT,
  receiveBatchSize: +BATCH_SIZE,
  activePollIntervalMs: +POOL_INTERVAL_MS,
};

if (DEBUG_SQUISS) console.log('SquissOptions', SquissOptions);

const bodyFormat: string = SQUISS_BODY_FORMAT;
if (bodyFormat === 'json' || bodyFormat === 'plain') {
  SquissOptions.bodyFormat = bodyFormat;
}

const poller = new Squiss(SquissOptions);

poller.start()
  .then(() =>
      console.log("---- QUEUE STARTED SUCCESSFULLY ----")
    // Print('Queue Started Successfully').ok()
  )
  .catch((err: any) => {
    console.warn(`QUEUE START ERROR - ${err.message}, Failed to start pooler.`);
    // Print(`QUEUE START ERROR - ${err.message}, Failed to start pooler.`).err();
  });

poller.on('message', async (msg) => {
  const req = msg.body;

  let url = API_URL;

  const options: IOptions = {
    method: 'POST',
    dataType: 'json',
  };

  options.data = JSON.stringify(req);
  console.log("JOB DISPATCHED -> UUID : " + req.uuid + " FILE : " + req.displayName);

  if (req.headers) {
    options.headers = req.headers;
  }

  await axios(url, options).then((response: AxiosResponse<any>) => {
    if (!response) {
      Print(`Job not successfully sent to the api`).err();
      msg.keep();
      return;
    }

    const reasonPhrase: string = response && response?.data?.reason_phrase || '-';
    const statusCode: number = response.status;

    const successCode: boolean = statusCode >= 200 && statusCode <= 299;
    const clientError: boolean = statusCode >= 400 && statusCode <= 499;

    if (successCode || clientError) {
      // Print(`job completed`).ok();
      console.log("---- JOB COMPLETED ----");
      msg.del();
    } else {
      console.warn(`Job not completed - ${reasonPhrase}`);
      // Print(`Job not completed - ${reasonPhrase}`).warn();
      msg.keep();
    }
  }).catch((err: AxiosError) => {
    console.warn(err.message || 'Failed to identify reason [AXIOS-CATCH].');
    // Print(err.message || 'Failed to identify reason [AXIOS-CATCH].').err();
    msg.keep();
  });
});
