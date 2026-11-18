import resendService from '../service/resend-service';
import app from '../hono/hono';
app.post('/webhooks',async (c) => {
	try {
		// 验签需要原始请求体与 svix 签名头，不能先 json 解析
		const rawBody = await c.req.text();
		const svixHeaders = {
			'svix-id': c.req.header('svix-id'),
			'svix-timestamp': c.req.header('svix-timestamp'),
			'svix-signature': c.req.header('svix-signature')
		};
		await resendService.webhooks(c, rawBody, svixHeaders);
		return c.text('success', 200)
	} catch (e) {
		return  c.text(e.message, 500)
	}
})
