import axios, {AxiosError, AxiosResponse} from 'axios';
import {IOptions, ProcessEnv} from './index.ds';

const {
  API_URL = '',
  DATA_TYPE_POST = 'json',
  PRINT_HEADERS = '',
  PRINT_RESPONSE = '',
}: ProcessEnv = process.env;

export const onMessage = async (msg: any) => {
  const req = msg.body;

  let url = req.url || API_URL;
  if (req.path) url = `${url}${req.path}`;

  const options: IOptions = {
    method: (req.method || 'POST').toUpperCase(),
    dataType: DATA_TYPE_POST,
  };

  if (req.data) {
    options.data = req.data;
  }

  if (req.headers) {
    options.headers = req.headers;
  }

  await axios(url, options).then((response: AxiosResponse<any>) => {
    if (!response) {
      console.warn(`REQUEST Did not return a response, Failed to identify the reason`);
      // Print(`REQUEST Did not return a response, Failed to identify the reason'}`).err();
      msg.keep();
      return;
    }

    const reasonPhrase: string = response && response?.data?.reason_phrase || '-';
    const statusCode: number = response.status;

    const successCode: boolean = statusCode >= 200 && statusCode <= 299;
    const clientError: boolean = statusCode >= 400 && statusCode <= 499;

    if (successCode || clientError) {
      console.log(`${reasonPhrase} / REMOVING the message, the Request WAS processed successfully`);
      // Print(`${reasonPhrase} / REMOVING the message, the Request WAS processed successfully`).ok();
      if (PRINT_HEADERS) {
        // eslint-disable-next-line no-console
        console.log('RESPONSE-HEADERS', response.headers);
      }

      if (PRINT_RESPONSE) {
        // eslint-disable-next-line no-console
        console.log('RESPONSE-DATA', response.data);
      }

      msg.del();
    } else {
      console.warn(`${reasonPhrase} / KEEPING the message, the Request was NOT processed`);
      // Print(`${reasonPhrase} / KEEPING the message, the Request was NOT processed`).warn();
      msg.keep();
    }
  }).catch((err: AxiosError) => {
    console.warn(err.message || 'Failed to identify reason [AXIOS-CATCH].');
    // Print(err.message || 'Failed to identify reason [AXIOS-CATCH].').err();
    msg.keep();
  });
};
