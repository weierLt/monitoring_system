import { Op } from 'sequelize';
import ResourceModel from '@/model/resource.model';
import type { Optional } from 'sequelize/types';

/**
 * @description: 向数据库插入一条静态资源请求信息
 * @param resourceInfo 静态资源请求信息
 */
export async function createResource_s(resourceInfo: Optional<any, string>) {
  const isExisted = !!(await findInfo(resourceInfo.resourceId));
  resourceInfo.timeStamp = parseInt(resourceInfo.timeStamp);

  return isExisted ? null : await ResourceModel.create(resourceInfo);
}

/**
 * @description: 在数据库中查找某个静态资源请求
 * @param resourceId 每一个静态资源的id
 */
export async function findInfo(resourceId: string) {
  const res = await ResourceModel.findOne({
    where: {
      resourceId,
    },
  });

  return res;
}

const oneDayHours = 24;
const oneHourMilliseconds = 60 * 60 * 1000;
const oneDayTime = oneDayHours * oneHourMilliseconds;

/**
 * @description: 获取静态资源请求数量
 */
export async function getResourceCount_s() {
  const now = Date.now();
  const queryConfigWhere = {
    timeStamp: {
      [Op.lt]: now,
      [Op.gt]: now - oneDayTime,
    },
  };

  const total = await ResourceModel.count({
    where: queryConfigWhere,
  });

  return total;
}