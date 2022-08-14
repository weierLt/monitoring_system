import { Op } from 'sequelize';
import dayjs from 'dayjs';
import { getRandomStr, uniq } from '@/utils';
import HttpModel from '@/model/http.model';
import ErrorModel from '@/model/error.model';
import type { Model, Optional } from 'sequelize/types';

/**
 * @description: 向数据库插入一条http请求信息
 * @param httpInfo http请求信息
 */
export async function createHttp_s(httpInfo: Optional<any, string>) {
  const isExisted = !!(await findInfo(httpInfo.httpId));
  httpInfo.timeStamp = parseInt(httpInfo.timeStamp);

  return isExisted ? null : await HttpModel.create(httpInfo);
}

/**
 * @description: 在数据库中查找某个http请求
 * @param httpId 每一个http请求的id
 */
export async function findInfo(httpId: string) {
  const res = await HttpModel.findOne({
    where: {
      httpId,
    },
  });

  return res;
}

const oneDayHours = 24;
const oneHourMilliseconds = 60 * 60 * 1000;
const oneDayTime = oneDayHours * oneHourMilliseconds;
const timeFormat = 'YYYY-MM-DD HH:00';
const process = (infos: Model<any, any>[]) => infos.map((errorInfo) => errorInfo.get());

/**
 * @description: 获取http调用成功率信息
 */
export async function getHttpSuccessRate_s() {
  const now = Date.now();
  const queryConfigWhere = {
    timeStamp: {
      [Op.lt]: now,
      [Op.gt]: now - oneDayTime,
    },
  };
  const successedHttpInfos = process(
    await HttpModel.findAll({
      attributes: ['timeStamp', 'requestUrl', 'status'],
      where: queryConfigWhere,
    }),
  );
  const failedHttpInfos = process(
    await ErrorModel.findAll({
      attributes: ['timeStamp', 'requestUrl', 'status'],
      where: {
        ...queryConfigWhere,
        type: 'httpError',
      },
    }),
  );

  const successRateInfos: Record<string, Record<string, [number, number]>> = {};
  const allHttpInfo = successedHttpInfos.concat(failedHttpInfos);

  for (const { timeStamp, requestUrl, status } of allHttpInfo) {
    if (!successRateInfos[requestUrl]) {
      const successRateInfo: Record<string, [number, number]> = {};

      for (let i = oneDayHours; i >= 0; i--) {
        const time = dayjs(now - i * oneHourMilliseconds).format(timeFormat);

        successRateInfo[time] = [0, 0];
      }

      successRateInfos[requestUrl] = successRateInfo;
    }

    const formatTime = dayjs(timeStamp).format(timeFormat);
    const successRateInfoByTime = successRateInfos[requestUrl][formatTime];
    status > 0 && status <= 400 && successRateInfoByTime[0]++;
    successRateInfoByTime[1]++;
  }

  return { successRateInfos, total: allHttpInfo.length };
}

/**
 * @description: 获取httpMsg聚类信息
 */
export async function getHttpMsgCluster_s() {
  const now = Date.now();
  const queryConfigWhere = {
    timeStamp: {
      [Op.lt]: now,
      [Op.gt]: now - oneDayTime,
    },
  };
  const successedHttpInfos = process(
    await HttpModel.findAll({
      attributes: ['requestUrl', 'status', 'httpMessage'],
      where: queryConfigWhere,
    }),
  );
  const failedHttpInfos = process(
    await ErrorModel.findAll({
      attributes: ['requestUrl', 'status', 'httpMessage'],
      where: {
        ...queryConfigWhere,
        type: 'httpError',
      },
    }),
  );

  const msgClusterInfos: Record<string, Record<string, Record<string, number>>> = {};
  const allHttpInfo = successedHttpInfos.concat(failedHttpInfos);

  for (const { requestUrl, status, httpMessage } of allHttpInfo) {
    if (!msgClusterInfos[httpMessage]) {
      msgClusterInfos[httpMessage] = {};
    }

    const callCount = msgClusterInfos[httpMessage][requestUrl]?.callCount;

    msgClusterInfos[httpMessage][requestUrl] = {
      callCount: callCount === void 0 ? 1 : (callCount as number) + 1,
      status,
    };
  }

  return msgClusterInfos;
}

type TimeConsumeInfo = Record<
  string,
  {
    callCount: number;
    duration: number;
  }
>;

/**
 * @description: 获取http耗时信息
 */
export async function getHttpTimeConsume_s(type: 'success' | 'fail') {
  const now = Date.now();
  const queryConfigWhere = {
    timeStamp: {
      [Op.lt]: now,
      [Op.gt]: now - oneDayTime,
    },
  };
  const httpInfos = process(
    type === 'success'
      ? await HttpModel.findAll({
          attributes: ['timeStamp', 'requestUrl', 'duration'],
          where: queryConfigWhere,
        })
      : await ErrorModel.findAll({
          attributes: ['timeStamp', 'requestUrl', 'duration'],
          where: { ...queryConfigWhere, type: 'httpError' },
        }),
  );

  const timeConsumeInfos: Record<string, TimeConsumeInfo> = {};

  for (const { timeStamp, requestUrl, duration } of httpInfos) {
    const timeConsumeInfo: TimeConsumeInfo = {};

    for (let i = oneDayHours; i >= 0; i--) {
      const time = dayjs(now - i * oneHourMilliseconds).format(timeFormat);

      timeConsumeInfo[time] = {
        callCount: 0,
        duration: 0,
      };
    }

    timeConsumeInfos[requestUrl] ?? (timeConsumeInfos[requestUrl] = timeConsumeInfo);
    const formatTime = dayjs(timeStamp).format(timeFormat);
    const timeConsumeInfoByTime = timeConsumeInfos[requestUrl][formatTime];

    timeConsumeInfoByTime.callCount++;
    timeConsumeInfoByTime.duration += parseInt(duration);
  }

  let result = uniq(httpInfos, (a, b) => a.requestUrl === b.requestUrl);

  result.forEach(({ requestUrl }) => {
    const timeConsumeInfo = timeConsumeInfos[requestUrl];

    for (const time in timeConsumeInfo) {
      if (Object.prototype.hasOwnProperty.call(timeConsumeInfo, time)) {
        const { callCount, duration } = timeConsumeInfo[time];

        if (callCount === 0) continue;

        timeConsumeInfo[time].duration = duration;
      }
    }
  });

  return { timeConsumeInfos, total: httpInfos.length };
}

/**
 * @description: 获取所有http请求信息（做成表格）
 */

export async function getAllHttpInfos_s(current: number, size: number) {
  const now = Date.now();
  const queryConfigWhere = {
    timeStamp: {
      [Op.lt]: now,
      [Op.gt]: now - oneDayTime,
    },
  };
  const defaultQueryConfig = {
    attributes: ['timeStamp', 'originUrl', 'requestUrl', 'status', 'httpMessage', 'duration'],
    limit: size,
    offset: (current - 1) * size,
    order: [['timeStamp', 'DESC']],
  };
  const httpModelQueryConfig: Record<string, any> = {
    ...defaultQueryConfig,
    where: queryConfigWhere,
  };
  const errorModelQueryConfig: Record<string, any> = {
    ...defaultQueryConfig,
    where: {
      ...queryConfigWhere,
      type: 'httpError',
    },
  };
  const total = (await HttpModel.count(httpModelQueryConfig)) + (await ErrorModel.count(errorModelQueryConfig));

  const allHttpInfos = [
    ...process(await HttpModel.findAll(httpModelQueryConfig)),
    ...process(await ErrorModel.findAll(errorModelQueryConfig)),
  ]
    .sort((b, a) => a.timeStamp - b.timeStamp)
    .slice(0, size)
    .map((info) => ({
      ...info,
      key: getRandomStr(),
      date: dayjs(info.timeStamp).format('YYYY-MM-DD HH:mm:ss'),
    }));

  return {
    current,
    size,
    total,
    records: allHttpInfos,
  };
}