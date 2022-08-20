const api = {
  getErrorCount: '/error/count', // 获取错误数量
  getResourceErrorData: '/error/getResourceErrorData', // 获取资源加载错误数据
  getResourceCount: '/resource/getResourceCount', // 获取静态资源数量
  getResourceData: '/resource/getResourceData', // 获取静态资源数据
  getHttpSuccessRate: '/http/getHttpSuccessRate', // 获取http请求成功率数据
  getHttpMsgCluster: '/http/getHttpMsgCluster', // 获取http请求Msg聚类信息数据
  getHttpTimeConsume: '/http/getHttpTimeConsume', // 获取http请求耗时信息数据
  getAllHttpInfos: '/http/getAllHttpInfos', // 获取所有http请求信息数据
  getUservitalsData: '/business/getUservitalsData',
  getPerformanceData: '/performance/getPerformanceData',
};

export default api;
