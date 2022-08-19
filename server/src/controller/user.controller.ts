import { createUser, userExistJudge, userPasswordJudge } from '@/service/user.service';
import type { Context } from 'koa';

export async function register(ctx: Context) {
  const { username, password } = ctx.request.body;

  try {
    const isUserExist = await userExistJudge(username);
    if (isUserExist) {
      ctx.defaultResponse({
        code: 400,
        message: '用户已经存在',
      });
    } else {
      await createUser(username, password);

      ctx.defaultResponse({
        message: '注册成功',
      });
    }
  } catch (err) {
    console.log(err);
    ctx.defaultError({ code: 500, message: '服务器出错' });
  }
}

export async function login(ctx: Context) {
  const { username, password } = ctx.request.body;
  try {
    const isUserExist = await userExistJudge(username);

    if (isUserExist) {
      const res = await userPasswordJudge(username, password);

      if (res) {
        ctx.defaultResponse({
          message: '登录成功',
          data: res,
        });
      } else {
        ctx.defaultResponse({
          code: 400,
          message: '密码错误',
        });
      }
    } else {
      ctx.defaultResponse({
        code: 400,
        message: '用户不存在',
      });
    }
  } catch (err) {
    console.log(err);
    ctx.defaultError({ code: 500, message: '服务器出错' });
  }
}
