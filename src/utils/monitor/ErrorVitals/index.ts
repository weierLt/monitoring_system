import { JsError, PromiseError, ResourceError, HttpRequestError, HttpRequest } from './errorClass';
import { pocessStackInfo, getErrorKey, errorTypeMap } from './utils';
import { EngineInstance, initOptions } from '..';
import TransportInstance, { transportKind, transportType, transportHandlerType } from '../Transport';
import { httpUrl } from '../utils/urls';
import { ErrorType } from './type';

const HTTP_MAX_LIMIT = 10;
const httpSet = new Set<HttpRequest>();

export default class ErrorVitals {
  serverUrl: string; // 上报错误数据url
  transportInstance: TransportInstance;

  constructor(public engineInstance: EngineInstance, public options: initOptions) {
    this.transportInstance = this.engineInstance.transportInstance;

    const serverUrl = this.transportInstance.options.transportUrl.get(transportKind.stability)!;
    this.serverUrl = serverUrl instanceof URL ? serverUrl.href : serverUrl;
    this.init();

    window.addEventListener('beforeunload', () => {
      const handler = this.transportInstance.beaconTransportHandler();

      if (httpSet.size) {
        httpSet.forEach((h) => handler(h, httpUrl));
        httpSet.clear();
      }
    });
  }

  init() {
    this.initJsError();
    this.initResourceError();
    this.initPromiseError();
    this.initProxyXml();
    this.initProxyFetch();
  }

  /**
   * @description: 上报错误数据方法
   * @param errorType 错误类型
   * @param errorData 错误数据
   */
  sendError(
    errorType: transportType,
    errorData: JsError | PromiseError | ResourceError | HttpRequestError | HttpRequest,
  ) {
    this.transportInstance.kernelTransportHandler(
      transportKind.stability,
      errorType,
      errorData,
      transportHandlerType.imageTransport,
    );
  }

  /**
   * @description: 监听js错误
   */
  initJsError() {
    const handler = (e: ErrorEvent) => {
      if (getErrorKey(e) !== ErrorType.JS) return;
      const { error, message: errorMsg, lineno, colno } = e;
      const errorType = error.toString().split(':')[0];
      const errorStack = error.stack;
      const jsError = new JsError(
        {
          errorType,
          errorStack: pocessStackInfo(errorStack),
          errorMsg,
          errPos: `${lineno}:${colno}`,
        },
        this.options,
      );

      jsError.errorId && this.sendError(transportType.jsError, jsError);
    };

    window.addEventListener('error', handler, true);
  }

  /**
   * @description: 监听静态资源加载错误
   */
  initResourceError() {
    const handler = (e: ErrorEvent) => {
      if (getErrorKey(e) !== ErrorType.RS) return;

      const { attributes } = e.target as HTMLElement;
      const errorType = ErrorType.RS;
      const requestUrl = attributes.getNamedItem('src')?.nodeValue ?? attributes.getNamedItem('href')?.nodeValue;

      const errorMsg = 'resource loading error';
      const resourceError = new ResourceError(
        {
          errorType,
          errorMsg,
          requestUrl: requestUrl as string,
        },
        this.options,
      );

      resourceError.errorId && this.sendError(transportType.resourceError, resourceError);
    };

    window.addEventListener('error', handler, true);
  }

  /**
   * @description: 监听没有catch的promise错误
   */
  initPromiseError() {
    const handler = (e: PromiseRejectionEvent) => {
      const defaultErrorParams = {
        errorType: ErrorType.UJ,
      };
      let promiseError: PromiseError;

      if (typeof e.reason === 'object') {
        const { stack: errorStack, message: errorMsg } = e.reason;

        promiseError = new PromiseError(
          Object.assign(defaultErrorParams, {
            errorStack: pocessStackInfo(errorStack),
            errorMsg,
          }),
          this.options,
        );
      } else {
        promiseError = new PromiseError(
          Object.assign(defaultErrorParams, {
            errorMsg: e.reason,
          }),
          this.options,
        );
      }

      promiseError.errorId && this.sendError(transportType.promiseError, promiseError);
    };

    window.addEventListener('unhandledrejection', handler, true);
  }

  /**
   * @description: 劫持ajax请求
   */
  initProxyXml() {
    const options = this.options;
    const _this = this;

    XMLHttpRequest.prototype.oldOpen = XMLHttpRequest.prototype.open;
    // @ts-ignore
    XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
      async = true;

      this.ajaxData = {
        method,
        url,
      };

      return this.oldOpen(method, url, async, username, password);
    };

    XMLHttpRequest.prototype.oldSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      // 去除上报数据接口的错误捕获
      const start = Date.now();
      const handleError = function (this: XMLHttpRequest, e: ProgressEvent<XMLHttpRequestEventTarget>) {
        const { type: eventType } = e;
        let {
          ajaxData: { url: requestUrl, method },
          status,
          statusText,
          responseText,
        } = this;

        const requestUrlStr = requestUrl instanceof URL ? requestUrl.href : requestUrl;
        method = method.toUpperCase();

        const defaultParams = {
          errorType: 'unknown',
          requestUrl: requestUrlStr.split('?')[0],
          method,
          status,
          statusText,
          duration: `${Date.now() - start}`,
        };

        // 根据状态码判断是否ajax请求是否出错
        if (eventType === 'loadend' && status < 400) {
          Reflect.deleteProperty(defaultParams, 'errorType');
          Reflect.deleteProperty(defaultParams, 'statusText');

          const httpRequest = new HttpRequest({ ...defaultParams, responseText }, options);

          if (httpRequest.httpId) {
            httpSet.add(httpRequest);

            if (httpSet.size === HTTP_MAX_LIMIT) {
              const handler = _this.transportInstance.beaconTransportHandler();

              httpSet.forEach((h) => handler(h, httpUrl));
              httpSet.clear();
            }
          }
          return;
        }

        if (window.navigator.onLine) {
          // eventType为'error'证明是网络断开或者请求跨域出错
          const httpRequestError = new HttpRequestError(
            {
              ...defaultParams,
              errorType: errorTypeMap[eventType],
            },
            options,
          );

          httpRequestError.errorId && _this.sendError(transportType.httpError, httpRequestError);
        } else {
          // 如果是断网导致的请求失败，则缓存请求，等到网络连接后重新上报数据
          window.addEventListener(
            'online',
            () => {
              const httpRequestError = new HttpRequestError(
                {
                  ...defaultParams,
                  errorType: ErrorType.XN,
                },
                options,
              );

              httpRequestError.errorId && _this.sendError(transportType.httpError, httpRequestError);
            },
            {
              once: true,
            },
          );
        }
      };

      // 监听网络错误和ajax跨域错误
      this.addEventListener('error', handleError, {
        once: true,
      });
      // 监听ajax超时错误
      this.addEventListener('timeout', handleError, {
        once: true,
      });
      // ajax取消错误
      this.addEventListener('abort', handleError, {
        once: true,
      });
      // 无论成功或者失败都会被监听到
      this.addEventListener(
        'loadend',
        function (e) {
          handleError.call(this, e);
          this.removeEventListener('error', handleError);
          this.removeEventListener('timeout', handleError);
          this.removeEventListener('abort', handleError);
        },
        {
          once: true,
        },
      );

      this.oldSend(body);
    };
  }

  /**
   * @description: 劫持fetch请求
   */
  initProxyFetch() {
    const oldFetch = window.fetch;

    const newFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const result = oldFetch(input, init);
      const start = Date.now();

      result.then((response) => {
        const { ok, status, statusText } = response;
        const cloneResponse = response.clone(); // 需要额外克隆一个流，不然外面的fetch使用response.json()等方法就会不起作用

        if (ok) {
          let httpRequest: HttpRequest;
          const defaultParams = {
            requestUrl: '',
            method: '',
            status,
            responseText: '',
            duration: `${Date.now() - start}`,
          };

          if (input instanceof Request) {
            const { url: requestUrl, method = 'GET' } = input;

            httpRequest = new HttpRequest(
              { ...defaultParams, requestUrl: requestUrl.split('?')[0], method: method.toUpperCase() },
              this.options,
            );
          } else {
            const requestUrl = input instanceof URL ? input.href : input;
            httpRequest = new HttpRequest(
              {
                ...defaultParams,
                requestUrl: requestUrl.split('?')[0],
                method: init?.method ? init.method.toUpperCase() : 'GET',
              },
              this.options,
            );
          }
          cloneResponse.text().then((text) => {
            httpRequest.responseText = text;
            if (httpRequest.httpId) {
              httpSet.add(httpRequest);

              if (httpSet.size === HTTP_MAX_LIMIT) {
                const handler = this.transportInstance.beaconTransportHandler();

                httpSet.forEach((h) => handler(h, httpUrl));
                httpSet.clear();
              }
            }
          });
        } else {
          let httpRequestError: HttpRequestError;
          const defaultParams = {
            errorType: ErrorType.HP,
            requestUrl: '',
            method: '',
            status,
            statusText,
            duration: `${Date.now() - start}`,
          };

          if (input instanceof Request) {
            const { url: requestUrl, method = 'GET' } = input;

            httpRequestError = new HttpRequestError(
              { ...defaultParams, requestUrl: requestUrl.split('?')[0], method: method.toUpperCase() },
              this.options,
            );
          } else {
            input = input instanceof URL ? input.href : input;
            httpRequestError = new HttpRequestError(
              {
                ...defaultParams,
                requestUrl: input.split('?')[0],
                method: init?.method ? init.method.toUpperCase() : 'GET',
              },
              this.options,
            );
          }

          this.sendError(transportType.httpError, httpRequestError);
        }
      });

      return result;
    };

    window.fetch = newFetch;
  }
}
