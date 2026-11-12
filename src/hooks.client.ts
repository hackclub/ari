import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';

// taken before sentry wraps the console, so logging an error here does not also send it as a log
const consoleError = console.error.bind(console);

// errors thrown while the sdk is still loading, replayed once it is ready
const earlyErrors: unknown[] = [];
const keepError = (event: ErrorEvent) => earlyErrors.push(event.error ?? event.message);
const keepRejection = (event: PromiseRejectionEvent) => earlyErrors.push(event.reason);

// sentry is about 150kb of script, so it loads beside the page instead of in front of it
const sentry = env.PUBLIC_SENTRY_DSN
	? import('@sentry/sveltekit')
			.then((sentrySdk) => {
				sentrySdk.init({
					dsn: env.PUBLIC_SENTRY_DSN,
					tracesSampleRate: 1,
					enableLogs: true,
					ignoreErrors: [/^TypeError: (Failed to fetch|NetworkError|Load failed)/],
					integrations: [sentrySdk.consoleLoggingIntegration({ levels: ['warn', 'error'] })]
				});
				for (const error of earlyErrors) sentrySdk.captureException(error);
				return sentrySdk;
			})
			// a blocked or offline sdk only loses reporting, never the page
			.catch(() => null)
			.finally(() => {
				removeEventListener('error', keepError);
				removeEventListener('unhandledrejection', keepRejection);
				earlyErrors.length = 0;
			})
	: null;
if (sentry) {
	addEventListener('error', keepError);
	addEventListener('unhandledrejection', keepRejection);
}

const isClientError = (status: unknown) =>
	typeof status === 'number' && status >= 400 && status < 500;

// mirrors Sentry.handleErrorWithSentry, which would need the sdk in the entry chunk
export const handleError: HandleClientError = ({ error, status }) => {
	consoleError(error);
	if (isClientError(status)) return;
	if (typeof error === 'object' && error !== null && isClientError(Reflect.get(error, 'status'))) {
		return;
	}
	void sentry?.then((sentrySdk) =>
		sentrySdk?.captureException(error, {
			mechanism: { type: 'auto.function.sveltekit.handle_error', handled: false }
		})
	);
};
