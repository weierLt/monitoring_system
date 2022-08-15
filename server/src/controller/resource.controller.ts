import { createResource_s, getResourceCount_s } from '@/service/resource.service';
import type { Context } from 'koa';

export async function createResource_c(ctx: Context) {
  const resourceInfos = ctx.request.body;

  try {
    for (const r of resourceInfos) {
      r.ip = ctx.ip;
      await createResource_s(r);
    }

    ctx.defaultResponse();
  } catch (err) {
    console.log(err);

    ctx.defaultError();
  }
}

export async function getResourceCount_c(ctx: Context) {
  try {
    const resourceCount = await getResourceCount_s();

    ctx.defaultResponse({
      code: 200,
      data: {
        total: resourceCount,
      },
      message: '请求成功',
      success: true,
    });
  } catch (err) {
    console.log(err);

    ctx.defaultError({ code: 500, message: '服务器出错' });
  }
}
