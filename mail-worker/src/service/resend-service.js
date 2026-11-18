import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import { Webhook } from 'svix';

// Resend 回调验签：配置了 resend_webhook_secret 才强制验签；
// 未配置时跳过验签并打警告日志，兼容尚未配置密钥的部署。
function verifyWebhookPayload(c, rawBody, svixHeaders) {
	const secret = (c.env.resend_webhook_secret || '').trim();
	if (!secret) {
		console.warn('resend webhook: resend_webhook_secret not configured, skipping signature verification');
		return JSON.parse(rawBody);
	}
	try {
		return new Webhook(secret).verify(rawBody, svixHeaders);
	} catch (e) {
		throw new Error(`resend webhook signature verification failed: ${e.message}`);
	}
}

const resendService = {

	async webhooks(c, rawBody, svixHeaders) {

		const body = verifyWebhookPayload(c, rawBody, svixHeaders);

		const params = {
			resendEmailId: body.data.email_id,
			status: emailConst.status.SENT
		}

		if (body.type === 'email.delivered') {
			params.status = emailConst.status.DELIVERED
			params.message = null
		}

		if (body.type === 'email.complained') {
			params.status = emailConst.status.COMPLAINED
			params.message = null
		}

		if (body.type === 'email.bounced') {
			let bounce = body.data.bounce
			bounce = JSON.stringify(bounce);
			params.status = emailConst.status.BOUNCED
			params.message = bounce
		}

		if (body.type === 'email.delivery_delayed') {
			params.status = emailConst.status.DELAYED
			params.message = null
		}

		if (body.type === 'email.failed') {
			params.status = emailConst.status.FAILED
			params.message = body.data.failed.reason
		}

		const emailRow = await emailService.updateEmailStatus(c, params)

		if (!emailRow) {
			// 未知邮件事件（如历史数据、重复投递、测试事件）：记录日志后正常返回，
			// 避免 Resend 因连续收到 500 而熔断关闭 Webhook
			console.warn(`resend webhook: unknown email_id ${params.resendEmailId}, type ${body.type}`);
			return;
		}

	}
}

export default resendService
